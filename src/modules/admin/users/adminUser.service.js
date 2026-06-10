const mongoose = require('mongoose');
const crypto = require('crypto');
const { RepositoryFactory } = require('@infra/database');
const {
  USER_STATUS,
  BET_STATUS,
  TRANSACTION_TYPE,
  TRANSACTION_SOURCE,
  TRANSACTION_REFERENCE_TYPE,
} = require('@config/constants/domain');
const { toPaise, toRupees } = require('@utils');
const { canonicalizePana } = require('@utils/panaCanonicalization');
const { normalizeBetValueToSelection } = require('@utils/betValueValidator');
const {
  parseExpandedBetReference,
  isMotorBetRecord,
  resolveMotorLineStakePaise,
  motorLineStakesToObject,
  computeMotorLineRemoval,
  expandHistoryBetItems,
  extractMotorPanas,
} = require('@modules/bets/betProjection.service');
const { NotFoundError, ValidationError, ConflictError } = require('@utils/errors');
const { ExposureDeltaGenerator, buildExposureSnapshot } = require('@domain/exposure');
const betsService = require('@modules/bets/bets.service');
const authRepository = RepositoryFactory.getRepository('Auth');

const userRepository = RepositoryFactory.getRepository('User');
const walletRepository = RepositoryFactory.getRepository('Wallet');
const betRepository = RepositoryFactory.getRepository('Bet');
const transactionRepository = RepositoryFactory.getRepository('Transaction');
const sessionExposureRepository = RepositoryFactory.getRepository('SessionExposure');
const gameTypeRepository = RepositoryFactory.getRepository('GameType');
const gameSessionRepository = RepositoryFactory.getRepository('GameSession');
const marketRepository = RepositoryFactory.getRepository('Market');
const bankDetailRepository = RepositoryFactory.getRepository('BankDetail');
const payoutRepository = RepositoryFactory.getRepository('Payout');

const toUserStatusView = (status) => (status === USER_STATUS.BANNED ? 'blocked' : status);
const toStoredStatus = (status) => (status === 'blocked' ? USER_STATUS.BANNED : USER_STATUS.ACTIVE);

const mapUserListItem = (user) => ({
  id: user._id,
  username: user.username,
  phone: user.phone,
  email: user.email || null,
  status: toUserStatusView(user.status),
  role: user.role?.code || null,
  isVerified: !!user.isVerified,
  lastLoginAt: user.lastLoginAt || null,
  createdAt: user.createdAt,
});

const mapBetItem = (bet) => {
  const rowId = String(bet.id);
  const storedBetId = String(bet.betId ?? bet.id);
  const isExpanded = !!bet.isExpanded;

  return {
    ...bet,
    id: rowId,
    rowId,
    betId: storedBetId,
    displayId: rowId,
    amount: Number(bet.amount ?? 0),
    totalAmount: bet.totalAmount !== undefined ? Number(bet.totalAmount) : Number(bet.amount ?? 0),
    payout: Number(bet.payout ?? 0),
    totalPayout: bet.totalPayout !== undefined ? Number(bet.totalPayout) : Number(bet.payout ?? 0),
    editScope: isExpanded ? 'row' : 'bet',
    canEdit: bet.status === BET_STATUS.PENDING,
    canDelete: bet.status === BET_STATUS.PENDING,
  };
};

const buildAdminBetRowResponse = async (betDoc, expansionKey = null) => {
  const { session, gameType, market } = await hydrateBetContext(betDoc);
  const plain = betDoc.toObject ? betDoc.toObject() : betDoc;
  const rows = expandHistoryBetItems({
    bet: plain,
    market,
    gameType,
    session,
  });

  const target = expansionKey
    ? rows.find((row) => String(row.expansionKey) === String(canonicalizePana(String(expansionKey))))
    : rows[0];

  return mapBetItem(target || rows[0]);
};

const mapTransactionItem = (item) => ({
  id: item._id,
  type: item.type,
  amount: toRupees(item.amount || 0),
  balanceAfter: toRupees(item.balanceAfter || 0),
  transactionContext: item.transactionContext || null,
  referenceType: item.referenceType || null,
  referenceId: item.referenceId || null,
  betResult: item.betResult || null,
  meta: item.meta || {},
  createdAt: item.createdAt,
});

const mapBankAccountItem = (item) => ({
  id: item._id,
  accountHolderName: item.accountHolderName || null,
  bankName: item.bankName || null,
  accountNumber: item.accountNumber || null,
  ifscCode: item.ifscCode || null,
  upiId: item.upiId || null,
  isDefault: !!item.isDefault,
  createdAt: item.createdAt || null,
  updatedAt: item.updatedAt || null,
});

const negateExposureDelta = (delta = {}) => ({
  totalCollection: -Number(delta.totalCollection || 0),
  totalBets: -Number(delta.totalBets || 0),
  singleExposure: Object.fromEntries(
    Object.entries(delta.singleExposure || {}).map(([key, value]) => [key, -Number(value || 0)]),
  ),
  jodiExposure: Object.fromEntries(
    Object.entries(delta.jodiExposure || {}).map(([key, value]) => [key, -Number(value || 0)]),
  ),
  panaExposure: Object.fromEntries(
    Object.entries(delta.panaExposure || {}).map(([key, value]) => [key, -Number(value || 0)]),
  ),
  compositeExposure: Object.fromEntries(
    Object.entries(delta.compositeExposure || {}).map(([key, value]) => [key, -Number(value || 0)]),
  ),
  digitStats: Array.isArray(delta.digitStats)
    ? delta.digitStats.map((stat) => ({
      digit: stat.digit,
      count: -Number(stat.count || 0),
      amount: -Number(stat.amount || 0),
    }))
    : [],
  gameTypeStats: Object.fromEntries(
    Object.entries(delta.gameTypeStats || {}).map(([key, value]) => [key, {
      count: -Number(value?.count || 0),
      amount: -Number(value?.amount || 0),
    }]),
  ),
});

const buildModeDeltaWithStats = (bet, sign = 1) => {
  const mapped = ExposureDeltaGenerator.generateFromBet(bet);
  if (!mapped) {
    return null;
  }

  const snapshot = buildExposureSnapshot([bet]);
  mapped.delta.totalBets = snapshot.totalBets;
  mapped.delta.digitStats = snapshot.digitStats;
  mapped.delta.gameTypeStats = snapshot.gameTypeStats;

  if (sign < 0) {
    return {
      mode: mapped.mode,
      delta: negateExposureDelta(mapped.delta),
    };
  }

  return mapped;
};

const ensureUserExists = async (userId) => {
  const user = await userRepository.findAdminDetailsById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
};

const hydrateBetContext = async (bet) => {
  const [session, gameType] = await Promise.all([
    gameSessionRepository.findLeanById(bet.sessionId),
    gameTypeRepository.findLeanById(bet.gameTypeId),
  ]);

  const market = session
    ? await marketRepository.findLeanById(session.marketId)
    : null;

  return { session, gameType, market };
};

const rebuildBetDraft = async (bet, payload) => {
  const { gameType } = await hydrateBetContext(bet);
  if (!gameType) {
    throw new ValidationError('Game type not found for bet');
  }

  const nextAmount = payload.amount !== undefined ? toPaise(payload.amount) : bet.amount;
  const nextSelection = payload.value !== undefined
    ? normalizeBetValueToSelection(payload.value, gameType.rules)
    : bet.selection;

  const templateUpper = String(gameType.templateKey || gameType.code || '').toUpperCase();
  const isMotor = templateUpper.includes('MOTOR');

  const generatedPanas = isMotor
    ? String(nextSelection)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => canonicalizePana(item))
    : bet.generatedPanas;

  const nextBet = {
    ...bet.toObject(),
    amount: nextAmount,
    selection: isMotor && Array.isArray(generatedPanas) && generatedPanas.length
      ? generatedPanas.join(',')
      : nextSelection,
    generatedPanas: isMotor && generatedPanas?.length ? generatedPanas : bet.generatedPanas,
    combinationCount: isMotor && generatedPanas?.length
      ? generatedPanas.length
      : bet.combinationCount,
    stakePerCombination: isMotor && generatedPanas?.length
      ? nextAmount / generatedPanas.length
      : bet.stakePerCombination,
    motorLineStakesPaise: isMotor ? undefined : bet.motorLineStakesPaise,
  };

  if (isMotor && generatedPanas?.length) {
    nextBet.stakePerCombination = nextAmount / generatedPanas.length;
  }

  return {
    nextBet,
    nextAmount,
    nextSelection,
    gameType,
  };
};

const listUsers = async (query = {}) => {
  const status = query.status ? toStoredStatus(query.status) : undefined;

  const { documents, total, page, limit } = await userRepository.findForAdminList({
    search: query.search ? String(query.search).trim() : undefined,
    status,
    sortBy: query.sortBy || 'createdAt',
    order: query.order || 'desc',
    query,
  });

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return {
    users: documents.map(mapUserListItem),
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  };
};

const getUserDetails = async (userId) => {
  const user = await ensureUserExists(userId);

  const [wallet, stats, bankAccounts] = await Promise.all([
    walletRepository.getExposureSummaryByUserId(userId),
    betRepository.getUserBetStats(userId),
    bankDetailRepository.findByUserId(userId),
  ]);

  const mappedBankAccounts = Array.isArray(bankAccounts)
    ? bankAccounts.map(mapBankAccountItem)
    : [];
  const primaryBankAccount = mappedBankAccounts.find((item) => item.isDefault) || mappedBankAccounts[0] || null;

  return {
    id: user._id,
    username: user.username,
    phone: user.phone,
    email: user.email || null,
    status: toUserStatusView(user.status),
    role: user.role?.code || null,
    isVerified: !!user.isVerified,
    wallet: {
      balance: toRupees(wallet?.balance || 0),
      exposure: toRupees(wallet?.exposure || 0),
      bonus: toRupees(wallet?.bonus || 0),
      currency: wallet?.currency || 'INR',
    },
    stats: {
      totalBets: stats.totalBets || 0,
      totalWagered: toRupees(stats.totalWagered || 0),
      totalWinnings: toRupees(stats.totalWinnings || 0),
      totalLosses: toRupees(stats.totalLosses || 0),
      netProfitLoss: toRupees((stats.totalWinnings || 0) - (stats.totalLosses || 0)),
    },
    accountStatus: toUserStatusView(user.status),
    lastLogin: user.lastLoginAt || null,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    bankAccount: primaryBankAccount,
    bankAccounts: mappedBankAccounts,
  };
};

const blockUser = async (userId) => {
  const updated = await userRepository.setStatus(userId, USER_STATUS.BANNED, {
    revokeRefreshToken: true,
  });

  if (!updated) {
    throw new NotFoundError('User not found');
  }

  return {
    id: updated._id,
    status: toUserStatusView(updated.status),
  };
};

const unblockUser = async (userId) => {
  const updated = await userRepository.setStatus(userId, USER_STATUS.ACTIVE);

  if (!updated) {
    throw new NotFoundError('User not found');
  }

  return {
    id: updated._id,
    status: toUserStatusView(updated.status),
  };
};

const getUserStats = async (userId) => {
  await ensureUserExists(userId);

  const stats = await betRepository.getUserBetStats(userId);
  return {
    totalBets: stats.totalBets || 0,
    totalWagered: toRupees(stats.totalWagered || 0),
    totalWinnings: toRupees(stats.totalWinnings || 0),
    totalLosses: toRupees(stats.totalLosses || 0),
    netProfitLoss: toRupees((stats.totalWinnings || 0) - (stats.totalLosses || 0)),
  };
};

const getUserBets = async (userId, query = {}) => {
  await ensureUserExists(userId);

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;

  const result = await betsService.getUserBets(
    userId,
    page,
    limit,
    {
      ...query,
      includeStoredBetId: true,
    },
  );

  return {
    items: result.items.map(mapBetItem),
    pagination: {
      page,
      limit,
      total: result.total,
      pages: Math.ceil(result.total / limit) || 1,
    },
  };
};

const getUserTransactions = async (userId, query = {}) => {
  await ensureUserExists(userId);

  const filters = {};
  if (query.type) {
    filters.type = query.type;
  }

  const { transactions, pagination } = await transactionRepository.getUserTransactions(
    userId,
    query.page,
    query.limit,
    filters,
  );

  return {
    items: transactions.map(mapTransactionItem),
    pagination,
  };
};

const deleteUserTransaction = async ({ userId, transactionId, adminUserId }) => {
  await ensureUserExists(userId);

  const transaction = await transactionRepository.findById(transactionId);

  if (!transaction || String(transaction.userId) !== String(userId)) {
    throw new NotFoundError('Transaction not found');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await walletRepository.debitBalance(userId, transaction.amount, session);

    await transactionRepository.recordAdminAdjustment({
      userId,
      amount: -transaction.amount,
      balanceAfter: wallet.balance,
      referenceId: `ADMIN_DEP_DEL_${transactionId}_${Date.now()}`,
      meta: {
        reason: 'Deposit transaction deleted by admin',
        adminUserId: adminUserId ? String(adminUserId) : null,
        deletedTransactionId: String(transactionId),
      },
    }, session);

    await transaction.deleteOne({ session });

    await session.commitTransaction();

    return { deleted: true, transactionId: String(transactionId) };
  } catch (error) {
    await session.abortTransaction();

    if (typeof error?.message === 'string' && error.message.includes('Insufficient balance')) {
      throw new ValidationError('Insufficient balance to reverse this deposit');
    }

    throw error;
  } finally {
    session.endSession();
  }
};

const buildWalletAdjustmentPayloadHash = ({
  operation,
  amount,
  reason = '',
  note = '',
  referenceSessionId = null,
}) => crypto
  .createHash('sha256')
  .update(JSON.stringify({
    operation,
    amount: Number(amount),
    reason,
    note,
    referenceSessionId,
  }))
  .digest('hex');

const adjustFunds = async ({
  userId,
  operation,
  amount,
  reason = '',
  note = '',
  idempotencyKey,
  referenceSessionId = null,
  adminUserId,
}) => {
  await ensureUserExists(userId);

  const amountPaise = toPaise(amount);
  const payloadHash = buildWalletAdjustmentPayloadHash({
    operation,
    amount,
    reason,
    note,
    referenceSessionId,
  });

  const existingTransaction = await transactionRepository.findByUserTypeAndIdempotencyKey({
    userId,
    type: TRANSACTION_TYPE.ADMIN_ADJUSTMENT,
    idempotencyKey,
  });

  if (existingTransaction) {
    if (existingTransaction.payloadHash !== payloadHash) {
      throw new ConflictError('idempotencyKey was already used with a different wallet adjustment payload');
    }

    const walletSnapshot = await walletRepository.getExposureSummaryByUserId(userId);
    return {
      operation,
      balance: toRupees(existingTransaction.balanceAfter || walletSnapshot?.balance || 0),
      exposure: toRupees(walletSnapshot?.exposure || 0),
      amount,
      idempotencyKey,
      transactionId: String(existingTransaction._id),
      replayed: true,
    };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = operation === 'credit'
      ? await walletRepository.creditBalance(userId, amountPaise, 'balance', session)
      : await walletRepository.debitBalance(userId, amountPaise, session);

    const transaction = await transactionRepository.recordAdminAdjustment({
      userId,
      amount: operation === 'credit' ? amountPaise : -amountPaise,
      balanceAfter: wallet.balance,
      referenceId: `ADMIN_FUNDS_${operation.toUpperCase()}_${Date.now()}`,
      idempotencyKey,
      payloadHash,
      transactionContext: {
        source: TRANSACTION_SOURCE.ADMIN,
        referenceType: TRANSACTION_REFERENCE_TYPE.ADMIN,
      },
      meta: {
        reason,
        operation,
        note,
        referenceSessionId,
        adminUserId: adminUserId ? String(adminUserId) : null,
      },
    }, session);

    await session.commitTransaction();

    return {
      operation,
      balance: toRupees(wallet.balance || 0),
      exposure: toRupees(wallet.exposure || 0),
      amount,
      idempotencyKey,
      transactionId: String(transaction._id),
      replayed: false,
    };
  } catch (error) {
    await session.abortTransaction();

    if (error?.code === 11000) {
      throw new ConflictError('idempotencyKey was already used for this wallet adjustment');
    }

    if (typeof error?.message === 'string' && error.message.includes('Insufficient balance')) {
      throw new ValidationError('Insufficient balance');
    }

    throw error;
  } finally {
    session.endSession();
  }
};

const updateUserBet = async ({
  userId,
  betId,
  payload,
  adminUserId,
}) => {
  await ensureUserExists(userId);

  let parsed = parseExpandedBetReference(betId);
  const bet = await betRepository.findOneByUserAndId(userId, parsed.storedBetId);

  if (!bet) {
    throw new NotFoundError('Bet not found');
  }

  if (bet.status !== BET_STATUS.PENDING) {
    throw new ValidationError('Only pending bets can be edited');
  }

  const { gameType } = await hydrateBetContext(bet);

  if (parsed.isExpanded && !isMotorBetRecord(bet.toObject(), gameType)) {
    throw new ValidationError('Composite bet id is only valid for motor bets');
  }

  if (!parsed.isExpanded && isMotorBetRecord(bet.toObject(), gameType) && payload.value !== undefined) {
    const panas = extractMotorPanas(bet.toObject()).map((p) => canonicalizePana(String(p)));
    let candidatePana = null;
    try {
      const normalized = normalizeBetValueToSelection(payload.value, gameType.rules);
      candidatePana = canonicalizePana(normalized);
    } catch {
      // fall through to validation error
    }
    if (candidatePana && panas.includes(candidatePana)) {
      parsed = { ...parsed, expansionKey: candidatePana, isExpanded: true };
      delete payload.value;
    } else {
      throw new ValidationError(
        'To edit a specific motor bet pana, use the expanded bet ID format: betId_pana (e.g. 507f1f77bcf86cd799439011_012)',
      );
    }
  }

  if (parsed.isExpanded && isMotorBetRecord(bet.toObject(), gameType)) {
    const canonicalLine = canonicalizePana(String(parsed.expansionKey));
    const panas = extractMotorPanas(bet.toObject()).map((p) => canonicalizePana(String(p)));

    if (!panas.includes(canonicalLine)) {
      throw new ValidationError('Motor line not found on this bet');
    }

    let stakesObj = motorLineStakesToObject(bet.toObject());
    if (!stakesObj) {
      stakesObj = Object.fromEntries(
        panas.map((p) => [p, resolveMotorLineStakePaise(bet, p)]),
      );
    }

    let activeLineKey = canonicalLine;

    if (payload.value !== undefined) {
      const normalized = normalizeBetValueToSelection(payload.value, gameType.rules);
      const parts = String(normalized)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => canonicalizePana(item));

      if (parts.length !== 1) {
        throw new ValidationError('Provide a single pana for this motor line');
      }

      const newKey = parts[0];

      if (newKey !== canonicalLine && panas.includes(newKey)) {
        throw new ValidationError('Pana already exists on this motor bet');
      }

      const movedStake = stakesObj[activeLineKey];
      delete stakesObj[activeLineKey];
      stakesObj[newKey] = movedStake;
      activeLineKey = newKey;
    }

    if (payload.amount !== undefined) {
      stakesObj[activeLineKey] = toPaise(payload.amount);
    }

    const nextPanas = panas.map((p) => (p === canonicalLine ? activeLineKey : p));

    for (const p of nextPanas) {
      if (!stakesObj[p] || stakesObj[p] <= 0) {
        throw new ValidationError('Each motor line must have a positive stake');
      }
    }

    const nextTotal = nextPanas.reduce((sum, p) => sum + Number(stakesObj[p] || 0), 0);
    const nextBetPlain = {
      ...bet.toObject(),
      selection: nextPanas.join(','),
      generatedPanas: nextPanas,
      combinationCount: nextPanas.length,
      amount: nextTotal,
      motorLineStakesPaise: stakesObj,
      stakePerCombination: null,
    };

    const originalBet = bet.toObject();
    const delta = nextTotal - bet.amount;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await walletRepository.rebalanceForBetEdit(userId, delta, session);

      bet.amount = nextTotal;
      bet.selection = nextBetPlain.selection;
      bet.generatedPanas = nextBetPlain.generatedPanas;
      bet.combinationCount = nextBetPlain.combinationCount;
      bet.stakePerCombination = null;
      bet.motorLineStakesPaise = new Map(Object.entries(stakesObj));
      await bet.save({ session });

      const deltas = [
        buildModeDeltaWithStats(originalBet, -1),
        buildModeDeltaWithStats(nextBetPlain, 1),
      ].filter(Boolean);

      for (const item of deltas) {
        await sessionExposureRepository.applyDelta({
          sessionId: bet.sessionId,
          mode: item.mode,
          delta: item.delta,
          session,
        });
      }

      if (delta !== 0) {
        await transactionRepository.recordAdminAdjustment({
          userId,
          amount: -delta,
          balanceAfter: wallet.balance,
          referenceId: `ADMIN_BET_EDIT_${parsed.storedBetId}_${Date.now()}`,
          transactionContext: {
            source: TRANSACTION_SOURCE.ADMIN,
            referenceType: TRANSACTION_REFERENCE_TYPE.ADMIN,
          },
          meta: {
            reason: 'Bet edited by admin',
            adminUserId: adminUserId ? String(adminUserId) : null,
            betId: String(parsed.storedBetId),
            motorExpansionKey: String(activeLineKey),
          },
        }, session);
      }

      await session.commitTransaction();

      const row = await buildAdminBetRowResponse(bet, activeLineKey);

      return {
        ...row,
        wallet: {
          balance: toRupees(wallet.balance || 0),
          exposure: toRupees(wallet.exposure || 0),
        },
      };
    } catch (error) {
      await session.abortTransaction();

      if (typeof error?.message === 'string' && error.message.includes('Insufficient balance')) {
        throw new ValidationError('Insufficient balance');
      }

      throw error;
    } finally {
      session.endSession();
    }
  }

  const originalBet = bet.toObject();
  const { nextBet, nextAmount, nextSelection } = await rebuildBetDraft(bet, payload);
  const delta = nextAmount - bet.amount;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await walletRepository.rebalanceForBetEdit(userId, delta, session);

    bet.amount = nextAmount;
    bet.selection = nextSelection;
    bet.generatedPanas = nextBet.generatedPanas;
    bet.combinationCount = nextBet.combinationCount;
    bet.stakePerCombination = nextBet.stakePerCombination;
    bet.motorLineStakesPaise = nextBet.motorLineStakesPaise;
    await bet.save({ session });

    const deltas = [
      buildModeDeltaWithStats(originalBet, -1),
      buildModeDeltaWithStats(nextBet, 1),
    ].filter(Boolean);

    for (const item of deltas) {
      await sessionExposureRepository.applyDelta({
        sessionId: bet.sessionId,
        mode: item.mode,
        delta: item.delta,
        session,
      });
    }

    if (delta !== 0) {
      await transactionRepository.recordAdminAdjustment({
        userId,
        amount: -delta,
        balanceAfter: wallet.balance,
        referenceId: `ADMIN_BET_EDIT_${parsed.storedBetId}_${Date.now()}`,
        transactionContext: {
          source: TRANSACTION_SOURCE.ADMIN,
          referenceType: TRANSACTION_REFERENCE_TYPE.ADMIN,
        },
        meta: {
          reason: 'Bet edited by admin',
          adminUserId: adminUserId ? String(adminUserId) : null,
          betId: String(parsed.storedBetId),
        },
      }, session);
    }

    await session.commitTransaction();

    const row = await buildAdminBetRowResponse(
      bet,
      parsed.isExpanded ? parsed.expansionKey : null,
    );

    return {
      ...row,
      wallet: {
        balance: toRupees(wallet.balance || 0),
        exposure: toRupees(wallet.exposure || 0),
      },
    };
  } catch (error) {
    await session.abortTransaction();

    if (typeof error?.message === 'string' && error.message.includes('Insufficient balance')) {
      throw new ValidationError('Insufficient balance');
    }

    throw error;
  } finally {
    session.endSession();
  }
};

const deleteUserBet = async ({
  userId,
  betId,
  adminUserId,
}) => {
  await ensureUserExists(userId);

  const parsed = parseExpandedBetReference(betId);
  const bet = await betRepository.findOneByUserAndId(userId, parsed.storedBetId);

  if (!bet) {
    throw new NotFoundError('Bet not found');
  }

  if (bet.status !== BET_STATUS.PENDING) {
    throw new ValidationError('Only pending bets can be deleted');
  }

  const { market, gameType } = await hydrateBetContext(bet);

  if (parsed.isExpanded && !isMotorBetRecord(bet.toObject(), gameType)) {
    throw new ValidationError('Composite bet id is only valid for motor bets');
  }

  if (parsed.isExpanded && isMotorBetRecord(bet.toObject(), gameType)) {
    const removal = computeMotorLineRemoval(bet.toObject(), parsed.expansionKey);

    if (!removal) {
      throw new ValidationError('Invalid motor line reference');
    }

    if (removal.cancelEntireBet) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const pendingSnapshot = bet.toObject();
        const refundAmount = bet.amount;
        const wallet = await walletRepository.releaseBetExposure(userId, refundAmount, session);

        bet.status = BET_STATUS.CANCELLED;
        bet.payout = 0;
        await bet.save({ session });

        const removeDelta = buildModeDeltaWithStats(pendingSnapshot, -1);
        if (removeDelta) {
          await sessionExposureRepository.applyDelta({
            sessionId: bet.sessionId,
            mode: removeDelta.mode,
            delta: removeDelta.delta,
            session,
          });
        }

        await transactionRepository.recordRefund({
          userId,
          amount: refundAmount,
          balanceAfter: wallet.balance,
          betIds: [bet._id],
          betCount: 1,
          sessionId: bet.sessionId,
          marketCode: market?.code || null,
          gameTypeCode: bet.gameTypeCodeSnapshot || null,
          referenceId: `ADMIN_BET_DELETE_${parsed.storedBetId}_${Date.now()}`,
          transactionContext: {
            source: TRANSACTION_SOURCE.ADMIN,
            referenceType: TRANSACTION_REFERENCE_TYPE.REFUND,
          },
          meta: {
            adminUserId: adminUserId ? String(adminUserId) : null,
            motorLineRemoved: String(parsed.expansionKey),
          },
        }, session);

        await session.commitTransaction();

        return {
          id: String(bet._id),
          rowId: String(bet._id),
          betId: String(bet._id),
          expansionKey: null,
          isExpanded: false,
          status: bet.status,
          refundedAmount: toRupees(refundAmount || 0),
          wallet: {
            balance: toRupees(wallet.balance || 0),
            exposure: toRupees(wallet.exposure || 0),
          },
        };
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }

    const originalBet = bet.toObject();
    const { nextPlain, refundPaise } = removal;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wallet = await walletRepository.releaseBetExposure(userId, refundPaise, session);

      bet.selection = nextPlain.selection;
      bet.generatedPanas = nextPlain.generatedPanas;
      bet.combinationCount = nextPlain.combinationCount;
      bet.amount = nextPlain.amount;
      bet.stakePerCombination = nextPlain.stakePerCombination;
      bet.motorLineStakesPaise = nextPlain.motorLineStakesPaise
        ? new Map(Object.entries(nextPlain.motorLineStakesPaise))
        : undefined;
      await bet.save({ session });

      const deltas = [
        buildModeDeltaWithStats(originalBet, -1),
        buildModeDeltaWithStats(nextPlain, 1),
      ].filter(Boolean);

      for (const item of deltas) {
        await sessionExposureRepository.applyDelta({
          sessionId: bet.sessionId,
          mode: item.mode,
          delta: item.delta,
          session,
        });
      }

      await transactionRepository.recordRefund({
        userId,
        amount: refundPaise,
        balanceAfter: wallet.balance,
        betIds: [bet._id],
        betCount: 1,
        sessionId: bet.sessionId,
        marketCode: market?.code || null,
        gameTypeCode: bet.gameTypeCodeSnapshot || null,
        referenceId: `ADMIN_BET_LINE_DELETE_${parsed.storedBetId}_${Date.now()}`,
        transactionContext: {
          source: TRANSACTION_SOURCE.ADMIN,
          referenceType: TRANSACTION_REFERENCE_TYPE.REFUND,
        },
        meta: {
          adminUserId: adminUserId ? String(adminUserId) : null,
          motorLineRemoved: String(parsed.expansionKey),
        },
      }, session);

      await session.commitTransaction();

      const row = await buildAdminBetRowResponse(bet, null);

      return {
        ...row,
        status: bet.status,
        refundedAmount: toRupees(refundPaise || 0),
        wallet: {
          balance: toRupees(wallet.balance || 0),
          exposure: toRupees(wallet.exposure || 0),
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const pendingSnapshot = bet.toObject();
    const refundAmount = bet.amount;
    const wallet = await walletRepository.releaseBetExposure(userId, refundAmount, session);

    bet.status = BET_STATUS.CANCELLED;
    bet.payout = 0;
    await bet.save({ session });

    const removeDelta = buildModeDeltaWithStats(pendingSnapshot, -1);
    if (removeDelta) {
      await sessionExposureRepository.applyDelta({
        sessionId: bet.sessionId,
        mode: removeDelta.mode,
        delta: removeDelta.delta,
        session,
      });
    }

    await transactionRepository.recordRefund({
      userId,
      amount: refundAmount,
      balanceAfter: wallet.balance,
      betIds: [bet._id],
      betCount: 1,
      sessionId: bet.sessionId,
      marketCode: market?.code || null,
      gameTypeCode: bet.gameTypeCodeSnapshot || null,
      referenceId: `ADMIN_BET_DELETE_${parsed.storedBetId}_${Date.now()}`,
      transactionContext: {
        source: TRANSACTION_SOURCE.ADMIN,
        referenceType: TRANSACTION_REFERENCE_TYPE.REFUND,
      },
      meta: {
        adminUserId: adminUserId ? String(adminUserId) : null,
      },
    }, session);

    await session.commitTransaction();

    return {
      id: String(bet._id),
      rowId: String(bet._id),
      betId: String(bet._id),
      expansionKey: null,
      isExpanded: false,
      status: bet.status,
      refundedAmount: toRupees(refundAmount || 0),
      wallet: {
        balance: toRupees(wallet.balance || 0),
        exposure: toRupees(wallet.exposure || 0),
      },
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const mapWithdrawalItem = (doc) => ({
  id: String(doc._id),
  amount: toRupees(doc.amount || 0),
  currency: doc.currency || 'INR',
  method: doc.method || null,
  status: doc.status,
  beneficiary: {
    accountHolderName: doc.beneficiary?.accountHolderName || null,
    bankName: doc.beneficiary?.bankName || null,
    bankAccount: doc.beneficiary?.bankAccount
      ? `XXXX${String(doc.beneficiary.bankAccount).slice(-4)}`
      : null,
    upiId: doc.beneficiary?.upiId || null,
  },
  failureReason: doc.failureReason || null,
  adminRemarks: doc.adminRemarks || null,
  processedAt: doc.processedAt || null,
  reversedAt: doc.reversedAt || null,
  requestedAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const getUserWithdrawals = async (userId, query = {}) => {
  await ensureUserExists(userId);

  const { documents, meta } = await payoutRepository.getUserWithdrawalHistory(userId, query);

  return {
    items: documents.map(mapWithdrawalItem),
    pagination: {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      pages: Math.ceil(meta.total / meta.limit) || 1,
    },
  };
};

const resetUserPassword = async (userId, { newPassword }) => {
  await ensureUserExists(userId);
  await authRepository.updatePassword(userId, newPassword);

  return {
    id: userId,
    message: 'Password reset successfully',
  };
};

module.exports = {
  listUsers,
  getUserDetails,
  blockUser,
  unblockUser,
  getUserStats,
  getUserBets,
  getUserTransactions,
  deleteUserTransaction,
  getUserWithdrawals,
  adjustFunds,
  updateUserBet,
  deleteUserBet,
  resetUserPassword,
};
