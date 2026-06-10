// repositories/transactionRepository.js
const BaseRepository = require('./baseRepository');
const { Transaction } = require('@infra/models');
const {
  TRANSACTION_TYPE,
  TRANSACTION_SOURCE,
  TRANSACTION_REFERENCE_TYPE,
  BET_STATUS,
} = require('@config/constants/domain');
const { ValidationError } = require('@utils/errors');

const buildTransactionContext = (source, referenceType) => ({
  source,
  referenceType,
});

const validateLedgerPayload = ({ type, transactionContext, betResult }) => {
  if (!transactionContext?.source || !transactionContext?.referenceType) {
    throw new ValidationError('transactionContext.source and transactionContext.referenceType are required');
  }

  const betResultAllowedTypes = new Set([
    TRANSACTION_TYPE.BET_DEBIT,
    TRANSACTION_TYPE.WIN_CREDIT,
    TRANSACTION_TYPE.REFUND,
  ]);

  if (betResult && !betResultAllowedTypes.has(type)) {
    throw new ValidationError(`betResult is not allowed for transaction type ${type}`);
  }
};

class TransactionRepository extends BaseRepository {
  constructor() {
    super(Transaction);
  }

  async createLedgerEntry(payload, session = null) {
    validateLedgerPayload(payload);

    return this.create(
      {
        ...payload,
        referenceType: payload.transactionContext.referenceType,
      },
      session,
    );
  }

  /**
   * Bet debit entry with full context
   * @param {Object} payload
   * @param {string} payload.userId
   * @param {number} payload.amount - in PAISE
   * @param {number} payload.balanceAfter - in PAISE
   * @param {Array} payload.betIds - Bet document IDs
   * @param {number} payload.betCount
   * @param {string} payload.sessionId - GameSession ID
   * @param {string} payload.marketCode - e.g., 'KALYAN', 'MAIN'
   * @param {string} payload.gameTypeCode - e.g., 'SINGLE', 'JODI', 'PANA'
   * @param {Array} payload.selections - e.g., ['5', '128']
   * @param {string} payload.betMode - 'open' or 'close'
   * @param {string} payload.referenceId - Original reference
   * @param {Object} payload.meta - Optional additional context
   * @param {Object} session - MongoDB transaction session
   */
  async recordBetDebit(
    {
      userId,
      amount,
      balanceAfter,
      betIds = [],
      betCount = 1,
      sessionId,
      marketCode,
      gameTypeCode,
      selections = [],
      betMode,
      referenceId,
      meta = {},
    },
    session = null,
  ) {
    return this.createLedgerEntry(
      {
        userId,
        type: TRANSACTION_TYPE.BET_DEBIT,
        amount: -amount,
        balanceAfter,
        transactionContext: buildTransactionContext(
          TRANSACTION_SOURCE.BET,
          TRANSACTION_REFERENCE_TYPE.BET,
        ),
        betIds,
        betCount,
        sessionId,
        marketCode,
        gameTypeCode,
        selections,
        betMode,
        referenceId,
        meta,
        betResult: BET_STATUS.PENDING,
      },
      session,
    );
  }

  /**
   * Win credit entry linked to original bet debit
   * @param {Object} payload
   * @param {string} payload.userId
   * @param {number} payload.amount - Win payout in PAISE
   * @param {number} payload.balanceAfter - in PAISE
   * @param {number} payload.winAmount - Total win in PAISE
   * @param {string} payload.relatedTransactionId - Original BET_DEBIT transaction ID
   * @param {Array} payload.betIds - Winning bet IDs
   * @param {string} payload.sessionId
   * @param {string} payload.marketCode
   * @param {string} payload.gameTypeCode
   * @param {Array} payload.selections
   * @param {string|null} payload.betMode
   * @param {string} payload.referenceId
   * @param {Object} session - MongoDB transaction session
   */
  async recordWinCredit(
    {
      userId,
      amount,
      balanceAfter,
      winAmount,
      relatedTransactionId,
      betIds = [],
      sessionId,
      marketCode,
      gameTypeCode,
      selections = [],
      betMode = null,
      referenceId = null,
    },
    session = null,
  ) {
    return this.createLedgerEntry(
      {
        userId,
        type: TRANSACTION_TYPE.WIN_CREDIT,
        amount,
        balanceAfter,
        transactionContext: buildTransactionContext(
          TRANSACTION_SOURCE.SYSTEM,
          TRANSACTION_REFERENCE_TYPE.SETTLEMENT,
        ),
        winAmount,
        betIds,
        sessionId,
        marketCode,
        gameTypeCode,
        selections,
        betMode,
        referenceId,
        relatedTransactionId,
        betResult: BET_STATUS.WON,
      },
      session,
    );
  }

  /**
   * Admin adjustment (deposit / penalty)
   */
  async recordAdminAdjustment(
    {
      userId,
      amount,
      balanceAfter,
      referenceId,
      meta = {},
      idempotencyKey = null,
      payloadHash = null,
      transactionContext = buildTransactionContext(
        TRANSACTION_SOURCE.ADMIN,
        TRANSACTION_REFERENCE_TYPE.ADMIN,
      ),
    },
    session = null,
  ) {
    return this.createLedgerEntry(
      {
        userId,
        type: TRANSACTION_TYPE.ADMIN_ADJUSTMENT,
        amount,
        balanceAfter,
        transactionContext,
        referenceId,
        idempotencyKey,
        payloadHash,
        meta,
      },
      session,
    );
  }

  /**
   * Refund entry
   */
  async recordRefund(
    {
      userId,
      amount,
      balanceAfter,
      betIds = [],
      betCount = 1,
      sessionId,
      marketCode,
      gameTypeCode,
      referenceId,
      meta = {},
      transactionContext = buildTransactionContext(
        TRANSACTION_SOURCE.SYSTEM,
        TRANSACTION_REFERENCE_TYPE.REFUND,
      ),
    },
    session = null,
  ) {
    return this.createLedgerEntry(
      {
        userId,
        type: TRANSACTION_TYPE.REFUND,
        amount, // Refund is positive (credit back)
        balanceAfter,
        betIds,
        betCount,
        sessionId,
        marketCode,
        gameTypeCode,
        transactionContext,
        referenceId,
        meta,
        betResult: BET_STATUS.REFUNDED,
      },
      session,
    );
  }

  /**
   * Deposit credit entry
   */
  async recordDeposit(
    { userId, amount, balanceAfter, referenceId, meta = {} },
    session = null,
  ) {
    return this.createLedgerEntry(
      {
        userId,
        type: TRANSACTION_TYPE.DEPOSIT,
        amount,
        balanceAfter,
        transactionContext: buildTransactionContext(
          TRANSACTION_SOURCE.SYSTEM,
          TRANSACTION_REFERENCE_TYPE.PAYMENT,
        ),
        referenceId,
        meta,
      },
      session,
    );
  }

  /**
   * Withdrawal debit entry
   */
  async recordWithdrawalDebit(
    { userId, amount, balanceAfter, referenceId, meta = {} },
    session = null,
  ) {
    return this.createLedgerEntry(
      {
        userId,
        type: TRANSACTION_TYPE.WITHDRAWAL_DEBIT,
        amount: -amount,
        balanceAfter,
        transactionContext: buildTransactionContext(
          TRANSACTION_SOURCE.SYSTEM,
          TRANSACTION_REFERENCE_TYPE.PAYOUT,
        ),
        referenceId,
        meta,
      },
      session,
    );
  }

  /**
   * Withdrawal reversal credit entry
   */
  async recordWithdrawalReversal(
    { userId, amount, balanceAfter, referenceId, meta = {} },
    session = null,
  ) {
    return this.createLedgerEntry(
      {
        userId,
        type: TRANSACTION_TYPE.WITHDRAWAL_REVERSAL,
        amount,
        balanceAfter,
        transactionContext: buildTransactionContext(
          TRANSACTION_SOURCE.SYSTEM,
          TRANSACTION_REFERENCE_TYPE.PAYOUT,
        ),
        referenceId,
        meta,
      },
      session,
    );
  }

  /**
   * Get user transaction history with pagination
   * Populates all references for full context
   */
  async getUserLedger(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ userId })
      .populate({
        path: 'betIds',
        select: 'selection amount oddsSnapshot status betMode sessionId gameTypeId gameTypeCodeSnapshot updatedAt',
        populate: [
          {
            path: 'sessionId',
            select: 'sessionDate marketId',
            populate: { path: 'marketId', select: 'code name' },
          },
          {
            path: 'gameTypeId',
            select: 'code name',
          },
        ],
      })
      .populate({
        path: 'sessionId',
        select: 'sessionDate marketId',
        populate: { path: 'marketId', select: 'code name' },
      })
      .populate('relatedTransactionId', 'amount type createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Transaction.countDocuments({ userId });

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user transactions with filters
   */
  async getUserTransactions(userId, page = 1, limit = 20, filters = {}) {
    const skip = (page - 1) * limit;
    const query = { userId, ...filters };

    const transactions = await Transaction.find(query)
      .populate({
        path: 'betIds',
        select: 'selection amount oddsSnapshot status betMode sessionId gameTypeId gameTypeCodeSnapshot updatedAt',
        populate: [
          {
            path: 'sessionId',
            select: 'sessionDate marketId',
            populate: { path: 'marketId', select: 'code name' },
          },
          {
            path: 'gameTypeId',
            select: 'code name',
          },
        ],
      })
      .populate({
        path: 'sessionId',
        select: 'sessionDate marketId',
        populate: { path: 'marketId', select: 'code name' },
      })
      .populate('relatedTransactionId', 'amount type createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Transaction.countDocuments(query);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user's pending bets (for settlement)
   */
  async getPendingBets(userId) {
    return await Transaction.find({
      userId,
      type: TRANSACTION_TYPE.BET_DEBIT,
      betResult: BET_STATUS.PENDING,
    })
      .populate('betIds')
      .lean();
  }

  async findBetDebitTransactionsByBetIds(betIds = [], session = null) {
    if (!Array.isArray(betIds) || betIds.length === 0) {
      return [];
    }

    const query = Transaction.find({
      type: TRANSACTION_TYPE.BET_DEBIT,
      betIds: { $in: betIds },
    }).lean();

    if (session) {
      query.session(session);
    }

    return query;
  }

  async findWinCreditsForDebitTransactions(transactionIds = [], betIds = [], session = null) {
    if (
      (!Array.isArray(transactionIds) || transactionIds.length === 0)
      && (!Array.isArray(betIds) || betIds.length === 0)
    ) {
      return [];
    }

    const conditions = [];

    if (Array.isArray(transactionIds) && transactionIds.length > 0) {
      conditions.push({ relatedTransactionId: { $in: transactionIds } });
    }

    if (Array.isArray(betIds) && betIds.length > 0) {
      conditions.push({ betIds: { $in: betIds } });
    }

    const query = Transaction.find({
      type: TRANSACTION_TYPE.WIN_CREDIT,
      $or: conditions,
    }).lean();

    if (session) {
      query.session(session);
    }

    return query;
  }

  async findById(id, session = null) {
    const query = Transaction.findById(id);
    if (session) {
      query.session(session);
    }
    return query;
  }

  /**
   * Remove a bet ID from its BET_DEBIT transaction.
   *
   * - If the transaction has only this one betId, deletes the entire
   *   transaction document.
   * - If the transaction has multiple betIds, pulls this betId from
   *   the array and decrements betCount.
   *
   * Returns the (updated or deleted) transaction, or null if no matching
   * BET_DEBIT transaction was found.
   */
  async removeBetFromDebitTransaction(betId, session = null) {
    const txn = await this.model.findOne({
      type: TRANSACTION_TYPE.BET_DEBIT,
      betIds: betId,
    }).session(session || null);

    if (!txn) {
      return null;
    }

    if (txn.betIds.length <= 1) {
      await this.model.deleteOne({ _id: txn._id }).session(session || null);
      return txn;
    }

    return this.model.findOneAndUpdate(
      { _id: txn._id },
      {
        $pull: { betIds: betId },
        $inc: { betCount: -1 },
      },
      { new: true, session: session || null },
    );
  }

  async findByUserTypeAndIdempotencyKey({ userId, type, idempotencyKey }, session = null) {
    if (!userId || !type || !idempotencyKey) {
      return null;
    }

    const query = Transaction.findOne({ userId, type, idempotencyKey });
    if (session) {
      query.session(session);
    }

    return query;
  }
}

module.exports = TransactionRepository;

