const { RepositoryFactory } = require('@infra/database');
const { TRANSACTION_TYPE, TRANSACTION_REFERENCE_TYPE } = require('@config/constants/domain');
const { toRupees } = require('@utils');
const { ValidationError, UnauthorizedError, NotFoundError } = require('@utils/errors');

const userRepository = RepositoryFactory.getRepository('User');
const walletRepository = RepositoryFactory.getRepository('Wallet');
const txRepo = RepositoryFactory.getRepository('Transaction');
const paymentRepository = RepositoryFactory.getRepository('Payment');
const payoutRepository = RepositoryFactory.getRepository('Payout');

const RESOLVED_BET_RESULTS = new Set(['won', 'lost', 'refunded']);

const toISODateOrNull = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const summarizeBetResolution = (bets = [], fallbackStatus = null) => {
  const statuses = bets
    .map((bet) => String(bet?.status || '').toLowerCase())
    .filter(Boolean);

  if (statuses.length === 0) {
    const normalizedFallback = String(fallbackStatus || '').toLowerCase();
    return {
      betResult: normalizedFallback || 'pending',
      settlementStatus: normalizedFallback && normalizedFallback !== 'pending' ? 'settled' : 'pending',
      settledAt: null,
    };
  }

  const uniqueStatuses = [...new Set(statuses)];
  const settlementStatus = statuses.every((status) => RESOLVED_BET_RESULTS.has(status))
    ? 'settled'
    : 'pending';

  const betResult = uniqueStatuses.length === 1
    ? uniqueStatuses[0]
    : 'mixed';

  const settledAt = settlementStatus === 'settled'
    ? toISODateOrNull(
      bets.reduce((latest, bet) => {
        const updatedAt = bet?.updatedAt ? new Date(bet.updatedAt) : null;
        if (!updatedAt || Number.isNaN(updatedAt.getTime())) {
          return latest;
        }
        if (!latest || updatedAt > latest) {
          return updatedAt;
        }
        return latest;
      }, null),
    )
    : null;

  return {
    betResult,
    settlementStatus,
    settledAt,
  };
};

const buildDebitSettlementMap = (debitTransactions = [], settlementCredits = []) => {
  const byRelatedTransactionId = new Map();
  const fallbackByBetId = new Map();

  for (const credit of settlementCredits) {
    if (credit?.relatedTransactionId) {
      const key = String(credit.relatedTransactionId);
      const existing = byRelatedTransactionId.get(key) || [];
      existing.push(credit);
      byRelatedTransactionId.set(key, existing);
      continue;
    }

    for (const betId of credit?.betIds || []) {
      const key = String(betId);
      const existing = fallbackByBetId.get(key) || [];
      existing.push(credit);
      fallbackByBetId.set(key, existing);
    }
  }

  const settlementMap = new Map();

  for (const transaction of debitTransactions) {
    const transactionId = String(transaction._id);
    let credits = byRelatedTransactionId.get(transactionId) || [];

    if (credits.length === 0) {
      const seen = new Set();
      credits = [];
      for (const bet of transaction.betIds || []) {
        const matches = fallbackByBetId.get(String(bet?._id || bet)) || [];
        for (const credit of matches) {
          const creditId = String(credit._id);
          if (!seen.has(creditId)) {
            seen.add(creditId);
            credits.push(credit);
          }
        }
      }
    }

    const creditedWinAmount = credits.reduce((sum, credit) => sum + Number(credit?.amount || 0), 0);
    const settledAt = credits.reduce((latest, credit) => {
      const creditDate = credit?.createdAt ? new Date(credit.createdAt) : null;
      if (!creditDate || Number.isNaN(creditDate.getTime())) {
        return latest;
      }
      if (!latest || creditDate > latest) {
        return creditDate;
      }
      return latest;
    }, null);

    settlementMap.set(transactionId, {
      creditedWinAmount,
      settledAt: toISODateOrNull(settledAt),
      relatedTransactionIds: credits.map((credit) => String(credit._id)),
    });
  }

  return settlementMap;
};

const maskBankAccount = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) {
    return null;
  }

  return `XXXX${digits.slice(-4)}`;
};

const maskUpiId = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized || !normalized.includes('@')) {
    return null;
  }

  const [name, domain] = normalized.split('@');
  if (!name || !domain) {
    return null;
  }

  return `${name.slice(0, Math.min(2, name.length))}***@${domain}`;
};

const mapDepositHistoryItem = (document) => ({
  id: String(document._id),
  provider: document.provider,
  amount: toRupees(document.amount),
  currency: document.currency,
  status: document.status,
  verificationStatus: document.verificationStatus || null,
  paymentReference: document.paymentReference || null,
  clientStatus: document.clientStatus || null,
  credited: Boolean(document.creditedAt),
  paidAt: document.paidAt || null,
  creditedAt: document.creditedAt || null,
  failedAt: document.failedAt || null,
  createdAt: document.createdAt || null,
  updatedAt: document.updatedAt || null,
});

const mapWithdrawalHistoryItem = (document) => ({
  id: String(document._id),
  provider: document.provider,
  amount: toRupees(document.amount),
  currency: document.currency,
  method: document.method,
  status: document.status,
  beneficiary: {
    accountHolderName: document.beneficiary?.accountHolderName || null,
    bankName: document.beneficiary?.bankName || null,
    maskedBankAccount: maskBankAccount(document.beneficiary?.bankAccount),
    maskedUpiId: maskUpiId(document.beneficiary?.upiId),
  },
  failureReason: document.failureReason || null,
  adminRemarks: document.adminRemarks || null,
  processedAt: document.processedAt || null,
  reversedAt: document.reversedAt || null,
  createdAt: document.createdAt || null,
  updatedAt: document.updatedAt || null,
});

class UsersService {
  deriveTransactionContext(tx = {}) {
    const firstBet = Array.isArray(tx.betIds) && tx.betIds.length > 0 ? tx.betIds[0] : null;
    const resolvedSession = tx.sessionId || firstBet?.sessionId || null;
    const resolvedMarket = resolvedSession?.marketId || null;

    return {
      sessionId: resolvedSession?._id || resolvedSession || null,
      marketCode: tx.marketCode || resolvedMarket?.code || null,
      marketName: resolvedMarket?.name || null,
      gameTypeCode: tx.gameTypeCode || firstBet?.gameTypeCodeSnapshot || firstBet?.gameTypeId?.code || null,
      betMode: tx.betMode || firstBet?.betMode || null,
      selections: tx.selections?.length
        ? tx.selections
        : (Array.isArray(tx.betIds) && tx.betIds.length > 0
          ? tx.betIds.map((bet) => bet?.selection).filter(Boolean)
          : undefined),
    };
  }

  async getProfile(userId) {
    if (!userId) {
      throw new UnauthorizedError('Unauthorized');
    }

    const user = await userRepository.findProfileById(userId);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  async updateProfile(userId, updateData) {
    if (!userId) {
      throw new UnauthorizedError('Unauthorized');
    }

    const allowed = ['username', 'avatar', 'phone'];
    const payload = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updateData, key)) {
        payload[key] = updateData[key];
      }
    }

    if (Object.keys(payload).length === 0) {
      throw new ValidationError('No updatable fields provided');
    }

    const updated = await userRepository.updateProfileById(userId, payload);

    if (!updated) {
      throw new NotFoundError('User not found or inactive');
    }
    return updated;
  }

  async getWalletSummary(userId) {
    if (!userId) {
      throw new UnauthorizedError('Unauthorized');
    }
    const wallet = await walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }
    return {
      balance: toRupees(wallet.balance),
      exposure: toRupees(wallet.exposure),
      bonus: toRupees(wallet.bonus),
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    };
  }

  async getTransactionHistory(userId, page, limit) {
    const { transactions, pagination } =
      await txRepo.getUserLedger(userId, page, limit);

    const debitTransactions = transactions.filter((tx) => tx.type === TRANSACTION_TYPE.BET_DEBIT);
    const debitTransactionIds = debitTransactions.map((tx) => tx._id);
    const debitBetIds = debitTransactions.flatMap((tx) => tx.betIds || []).map((bet) => bet?._id || bet);
    const settlementCredits = debitTransactionIds.length
      ? await txRepo.findWinCreditsForDebitTransactions(debitTransactionIds, debitBetIds)
      : [];
    const debitSettlementMap = buildDebitSettlementMap(debitTransactions, settlementCredits);

    const items = transactions.map((tx) => {
      const context = this.deriveTransactionContext(tx);
      const base = {
        id: tx._id,
        type: tx.type,
        amount: toRupees(Math.abs(tx.amount)),
        balanceAfter: toRupees(tx.balanceAfter),
        winAmount: tx.winAmount === undefined ? undefined : toRupees(tx.winAmount),
        sessionId: context.sessionId,
        createdAt: tx.createdAt,
      };

      if (tx.type === TRANSACTION_TYPE.BET_DEBIT) {
        const resolution = summarizeBetResolution(tx.betIds, tx.betResult);
        const settlement = debitSettlementMap.get(String(tx._id)) || {
          creditedWinAmount: 0,
          settledAt: resolution.settledAt,
          relatedTransactionIds: [],
        };

        return {
          ...base,
          market: context.marketCode,
          marketName: context.marketName,
          gameType: context.gameTypeCode,
          betMode: context.betMode,
          selections: context.selections,
          referenceType: TRANSACTION_REFERENCE_TYPE.BET,
          referenceCount: tx.betCount || 1,
          betResult: resolution.betResult,
          settlementStatus: resolution.settlementStatus,
          creditedWinAmount: toRupees(settlement.creditedWinAmount || 0),
          settledAt: settlement.settledAt || resolution.settledAt,
          relatedTransactionId: settlement.relatedTransactionIds[0] || null,
        };
      }

      if (tx.type === TRANSACTION_TYPE.WIN_CREDIT) {
        return {
          ...base,
          market: context.marketCode,
          marketName: context.marketName,
          gameType: context.gameTypeCode,
          betMode: context.betMode,
          selections: context.selections,
          betResult: 'won',
          settlementStatus: 'settled',
          creditedWinAmount: toRupees(Number(tx.amount || 0)),
          settledAt: toISODateOrNull(tx.createdAt),
          relatedTransactionId: tx.relatedTransactionId?._id || tx.relatedTransactionId || null,
        };
      }

      return base;
    });

    return {
      items,
      total: pagination.total,
    };
  }

  async getDepositHistory(userId, query) {
    const result = await paymentRepository.getUserDepositHistory(userId, query);

    return {
      data: result.documents.map(mapDepositHistoryItem),
      meta: result.meta,
    };
  }

  async getWithdrawalHistory(userId, query) {
    const result = await payoutRepository.getUserWithdrawalHistory(userId, query);

    return {
      data: result.documents.map(mapWithdrawalHistoryItem),
      meta: result.meta,
    };
  }
}

module.exports = new UsersService();

