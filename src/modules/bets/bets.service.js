const mongoose = require('mongoose');
const { RepositoryFactory } = require('@infra/database');
const { DateTime } = require('luxon');
const { toRupees, toPaise } = require('@utils');
const { BET_STATUS, MARKET_STATUS, BET_MODE } = require('@config/constants/domain');
const { ValidationError } = require('@utils/errors');
const { normalizeBetValueToSelection } = require('@utils/betValueValidator');
const { GameTypeRegistry, BettingRuleEngine } = require('@domain/rule-engine');
const { ExposureDeltaGenerator, buildExposureSnapshot } = require('@domain/exposure');
const {
  isMotorGameType,
  buildMotorSnapshot,
  expandHistoryBetItems,
} = require('./betProjection.service');
const {
  validatePlaceBetsPayload,
  validateBetsAgainstContext,
} = require('./bets.validator');
const { BUSINESS_TIMEZONE } = require('@utils/timezoneHelper');
const walletRepository = RepositoryFactory.getRepository('Wallet');
const betRepository = RepositoryFactory.getRepository('Bet');
const transactionRepository = RepositoryFactory.getRepository('Transaction');
const sessionExposureRepository = RepositoryFactory.getRepository('SessionExposure');
const gameSessionRepository = RepositoryFactory.getRepository('GameSession');
const gameTypeRepository = RepositoryFactory.getRepository('GameType');
const marketRepository = RepositoryFactory.getRepository('Market');
const globalConfigRepository = RepositoryFactory.getRepository('GlobalConfig');
// Why: one stored motor bet can expand into many visible history rows, so
// history fetches need controlled over-fetching to fill a page after expansion.
const HISTORY_EXPANSION_BATCH_FACTOR = 5;
const MAX_HISTORY_BATCH_SIZE = 100;
const MAX_HISTORY_BATCH_LOOPS = 20;

const bettingRuleEngine = new BettingRuleEngine();

const enforceBettingSettings = async (bets) => {
  const config = await globalConfigRepository.getOrCreateActiveConfig();
  if (config.globalBetting === false) {
    throw new ValidationError('Betting is currently disabled globally');
  }
  bettingRuleEngine.enforceGlobalBetLimits({ bets, globalConfig: config, toRupees });
};

const cloneBetValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneBetValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneBetValue(nestedValue)]),
    );
  }

  return value;
};

const findMarketByQuery = async (marketQuery) => {
  const value = String(marketQuery || '').trim();
  if (!value) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(value)) {
    return marketRepository.findLeanById(value);
  }

  return marketRepository.findLeanByCode(value);
};

const findGameTypeByQuery = async (gameTypeQuery) => {
  const value = String(gameTypeQuery || '').trim();
  if (!value) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(value)) {
    return gameTypeRepository.findLeanById(value);
  }

  return gameTypeRepository.findLeanByCode(value);
};

const parseDateRangeIST = (date) => {
  if (!date) {
    return null;
  }

  const parsed = DateTime.fromFormat(String(date).trim(), 'yyyy-MM-dd', {
    zone: BUSINESS_TIMEZONE,
  });

  if (!parsed.isValid) {
    throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
  }

  return {
    $gte: parsed.startOf('day').toJSDate(),
    $lte: parsed.endOf('day').toJSDate(),
  };
};

const getSessionGameTypeConfig = (gameSession, gameTypeId) => {
  if (!gameSession || !Array.isArray(gameSession.gameTypesSnapshot)) {
    return null;
  }

  const targetId = String(gameTypeId);
  return gameSession.gameTypesSnapshot.find((entry) => String(entry.gameTypeId) === targetId) || null;
};

const validateBetRangesAgainstSnapshot = ({ bets = [], gameTypeConfig }) => {
  const minBet = typeof gameTypeConfig?.minBet === 'number' ? toPaise(gameTypeConfig.minBet) : null;
  const maxBet = typeof gameTypeConfig?.maxBet === 'number' ? toPaise(gameTypeConfig.maxBet) : null;

  bets.forEach((bet) => {
    if (minBet !== null && bet.amount < minBet) {
      throw new ValidationError(`Minimum bet is ${gameTypeConfig.minBet}`);
    }

    if (maxBet !== null && bet.amount > maxBet) {
      throw new ValidationError(`Maximum bet is ${gameTypeConfig.maxBet}`);
    }
  });
};

const resolveTransactionBetMeta = (bets = []) => {
  const uniqueModes = [...new Set(
    bets
      .map((bet) => bet?.betMode)
      .filter(Boolean),
  )];

  if (uniqueModes.length <= 1) {
    return {
      betMode: uniqueModes[0] || null,
      meta: {},
    };
  }

  return {
    betMode: null,
    meta: { betModes: uniqueModes },
  };
};

const resolveRuntimeGameType = (gameType) => {
  if (!gameType) {
    return gameType;
  }

  const templateKey = GameTypeRegistry.inferTemplateKey(gameType);
  if (!templateKey) {
    return gameType;
  }

  const template = GameTypeRegistry.getTemplate(templateKey);
  const generatedRules = GameTypeRegistry.buildRulesFromTemplate(templateKey);
  const rawGameType = typeof gameType.toObject === 'function'
    ? gameType.toObject()
    : gameType;

  return {
    ...rawGameType,
    templateKey,
    rules: generatedRules || rawGameType.rules,
    betPhaseType: template?.betPhaseType || rawGameType.betPhaseType,
  };
};

const placeBets = async ({ userId, sessionId, gameTypeId, bets }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const storedGameType = await gameTypeRepository.findById(gameTypeId);
    if (!storedGameType) {
      throw new ValidationError('Invalid GameType');
    }
    const gameType = resolveRuntimeGameType(storedGameType);

    const gameSession = await gameSessionRepository.findById(sessionId);
    if (!gameSession) {
      throw new ValidationError('Invalid session');
    }

    const market = await marketRepository.findById(gameSession.marketId);
    if (!market) {
      throw new ValidationError('Market not found for session');
    }

    const sessionGameTypeConfig = getSessionGameTypeConfig(gameSession, gameTypeId);
    if (!sessionGameTypeConfig || sessionGameTypeConfig.status === MARKET_STATUS.INACTIVE) {
      throw new ValidationError('GameType not allowed in this market');
    }

    const oddsSnapshot =
      typeof sessionGameTypeConfig?.payoutMultiplier === 'number'
        ? sessionGameTypeConfig.payoutMultiplier
        : gameType.payoutMultiplier;

    const effectiveGameType = {
      ...gameType,
      betPhaseType: sessionGameTypeConfig.betPhaseType || gameType.betPhaseType,
    };

    await enforceBettingSettings(bets);
    validateBetsAgainstContext({
      bets,
      gameType: effectiveGameType,
      session: gameSession,
    });
    validateBetRangesAgainstSnapshot({ bets, gameTypeConfig: sessionGameTypeConfig });

    const totalAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);

    let wallet;
    try {
      wallet = await walletRepository.placeBetDebit(
        userId,
        totalAmount,
        session,
      );
    } catch (err) {
      if (err instanceof ValidationError) {
        throw err;
      }

      if (
        typeof err?.message === 'string' &&
        (err.message.includes('Insufficient balance') ||
          err.message.includes('wallet not found'))
      ) {
        throw new ValidationError('Insufficient balance');
      }

      throw err;
    }

    const createdBets = [];
    for (const bet of bets) {
      const selection = normalizeBetValueToSelection(bet.value, gameType.rules);
      let generatedPanas = null;
      let combinationCount = null;
      let stakePerCombination = null;

      if (isMotorGameType(gameType)) {
        ({ generatedPanas, combinationCount, stakePerCombination } = buildMotorSnapshot(bet, selection));
      }

      const newBet = await betRepository.createBet(
        {
          userId,
          sessionId,
          gameTypeId,
          betMode: bet.betMode,
          selection,
          amount: bet.amount,
          oddsSnapshot,
          gameTypeCodeSnapshot: effectiveGameType.code,
          gameTypeTemplateKey: effectiveGameType.templateKey || null,
          gameTypeRulesVersion: Number(effectiveGameType.rulesVersion || 1),
          generatedPanas,
          combinationCount,
          stakePerCombination,
          status: BET_STATUS.PENDING,
        },
        session,
      );

      createdBets.push(newBet);
    }

    const selections = createdBets.map((bet) => bet.selection);
    const transactionBetMeta = resolveTransactionBetMeta(createdBets);

    await transactionRepository.recordBetDebit(
      {
        userId,
        amount: totalAmount,
        balanceAfter: wallet.balance,
        betIds: createdBets.map((bet) => bet._id),
        betCount: createdBets.length,
        sessionId,
        marketCode: market.code,
        gameTypeCode: effectiveGameType.code,
        selections,
        betMode: transactionBetMeta.betMode,
        meta: transactionBetMeta.meta,
        referenceId: `MULTI_BET_${sessionId}_${Date.now()}`,
      },
      session,
    );

    // Why: exposure must stay financially consistent with wallet/bet writes,
    // so we derive and apply deltas before committing the same DB transaction.
    const exposureDeltas = ExposureDeltaGenerator.generateGroupedDeltas(createdBets);
    const groupedBets = {
      [BET_MODE.OPEN]: createdBets.filter((bet) => bet.betMode === BET_MODE.OPEN),
      [BET_MODE.CLOSE]: createdBets.filter((bet) => bet.betMode === BET_MODE.CLOSE),
    };

    for (const [mode, delta] of Object.entries(exposureDeltas)) {
      const snapshotMeta = buildExposureSnapshot(groupedBets[mode] || []);
      delta.totalBets = snapshotMeta.totalBets;
      delta.digitStats = snapshotMeta.digitStats;
      delta.gameTypeStats = snapshotMeta.gameTypeStats;

      const hasExposure =
        Number(delta.totalCollection || 0) > 0
        || Object.keys(delta.singleExposure || {}).length > 0
        || Object.keys(delta.jodiExposure || {}).length > 0
        || Object.keys(delta.panaExposure || {}).length > 0
        || Object.keys(delta.compositeExposure || {}).length > 0;

      if (!hasExposure) {
        continue;
      }

      await sessionExposureRepository.applyDelta({
        sessionId,
        mode,
        delta,
        session,
      });
    }

    await session.commitTransaction();

    return {
      totalBets: createdBets.length,
      totalAmount: toRupees(totalAmount),
      balance: toRupees(wallet.balance),
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const placeBetsFromRequest = async ({
  userId,
  sessionId,
  gameTypeId,
  bets,
}) => {
  const validated = validatePlaceBetsPayload({
    userId,
    sessionId,
    gameTypeId,
    bets,
  });

  const preparedBets = validated.bets.map((bet) => {
    if (!bet?.value) {
      throw new ValidationError(
        'Invalid bet payload: value is required for each bet',
      );
    }

    try {
      return {
        value: cloneBetValue(bet.value),
        amount: toPaise(bet.amount),
        betMode: bet.betMode,
      };
    } catch {
      throw new ValidationError(
        'Invalid bet payload: amount must be a number for each bet',
      );
    }
  });

  return placeBets({
    userId: validated.userId,
    sessionId: validated.sessionId,
    gameTypeId: validated.gameTypeId,
    bets: preparedBets,
  });
};

const getUserBets = async (userId, page = 1, limit = 20, filters = {}) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 20;
  if (page < 1) {
    page = 1;
  }
  if (limit < 1) {
    limit = 20;
  }
  const queryFilter = {
    status: { $ne: BET_STATUS.CANCELLED },
  };

  const dateRange = parseDateRangeIST(filters.date);
  if (dateRange) {
    queryFilter.createdAt = dateRange;
  }

  if (filters.market) {
    const market = await findMarketByQuery(filters.market);
    if (!market) {
      return { items: [], total: 0 };
    }

    const marketSessions = await gameSessionRepository.findLean(
      { marketId: market._id },
      '_id',
    );

    const sessionIds = marketSessions.map((s) => s._id);
    if (!sessionIds.length) {
      return { items: [], total: 0 };
    }

    queryFilter.sessionId = { $in: sessionIds };
  }

  if (filters.gameType) {
    const gameType = await findGameTypeByQuery(filters.gameType);
    if (!gameType) {
      return { items: [], total: 0 };
    }

    queryFilter.gameTypeId = gameType._id;
  }

  const expandedOffset = (page - 1) * limit;
  const targetVisibleCount = expandedOffset + limit;
  const batchSize = Math.min(limit * HISTORY_EXPANSION_BATCH_FACTOR, MAX_HISTORY_BATCH_SIZE);

  let batchPage = 1;
  let loops = 0;
  let hasMore = true;
  let pagination = {};
  const expandedItems = [];

  // Why: pagination is applied after motor expansion so the user sees exactly
  // `limit` visible rows even when one stored bet fans out into many items.
  while (hasMore && expandedItems.length < targetVisibleCount && loops < MAX_HISTORY_BATCH_LOOPS) {
    const batch = await betRepository.findByUser(
      userId,
      batchPage,
      batchSize,
      queryFilter,
    );

    const { documents = [], pagination: batchPagination = {} } = batch || {};
    if (batchPage === 1) {
      pagination = batchPagination;
    }

    if (!documents.length) {
      break;
    }

    const sessionIds = [
      ...new Set(documents.map((bet) => String(bet.sessionId))),
    ];
    const gameTypeIds = [
      ...new Set(documents.map((bet) => String(bet.gameTypeId))),
    ];

    const sessions = await gameSessionRepository.findLeanByIds(sessionIds);

    const gameTypes = await gameTypeRepository.findLeanByIds(gameTypeIds);

    const markets = await marketRepository.findLeanByIds(
      sessions.map((session) => session.marketId),
    );

    const sessionMap = Object.fromEntries(
      sessions.map((session) => [String(session._id), session]),
    );
    const gameTypeMap = Object.fromEntries(
      gameTypes.map((gameType) => [String(gameType._id), gameType]),
    );
    const marketMap = Object.fromEntries(
      markets.map((market) => [String(market._id), market]),
    );

    expandedItems.push(...documents.flatMap((bet) => {
      const session = sessionMap[String(bet.sessionId)];
      const market = session ? marketMap[String(session.marketId)] : null;
      const gameType = gameTypeMap[String(bet.gameTypeId)];

      return expandHistoryBetItems({
        bet,
        market,
        gameType,
        session,
      });
    }));

    hasMore = documents.length === batchSize;
    batchPage += 1;
    loops += 1;
  }

  const items = expandedItems.slice(expandedOffset, expandedOffset + limit);

  return {
    items,
    // Why: pagination metadata reports stored bet count rather than expanded rows
    // the stored bet count from the repository, not the expanded visible count.
    total: pagination.total || items.length,
  };
};

module.exports = {
  placeBets,
  placeBetsFromRequest,
  getUserBets,
};
