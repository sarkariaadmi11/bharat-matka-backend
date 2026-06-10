// repositories/betRepository.js
const BaseRepository = require('./baseRepository');
const { Bet } = require('@infra/models');
const mongoose = require('mongoose');
const { BET_STATUS } = require('@config/constants/domain');

class BetRepository extends BaseRepository {
  constructor() {
    super(Bet);
  }

  /**
   * Create bet inside transaction
   */
  async createBet(data, session = null) {
    return await this.create(data, session);
  }

  /**
   * [UPDATED] Find Pending Bets by Session AND Mode
   * Allows the engine to fetch only 'open' bets or only 'close' bets.
   */
  async findPendingBySession(sessionId, betMode = null) {
    const query = {
      sessionId,
      status: BET_STATUS.PENDING,
    };

    // If betMode is provided (e.g., 'open'), filter by it.
    if (betMode) {
      query.betMode = betMode;
    }

    // Using cursor for memory efficiency if volumes are high
    // or standard find if using pagination elsewhere.
    // For the Result Engine, we usually want a stream or batch.
    return await this.model.find(query);
  }

  /**
   * Fetches pending open-mode bets that require BOTH open and close results
   * to determine a winner: Jodi, Half Sangam A, Half Sangam B, Full Sangam.
   *
   * WHY: These bets are placed during the open phase (betMode='open') so the
   * standard close-phase preview query (betMode='close') excludes them entirely.
   * A dedicated query targets only the relevant game type keys so we avoid
   * pulling every open bet and filtering in memory.
   *
   * Covers modern bets (gameTypeTemplateKey) and legacy bets (gameTypeCodeSnapshot).
   */
  async findPendingCombinedResultBets(sessionId) {
    return await this.model.find({
      sessionId,
      status: BET_STATUS.PENDING,
      betMode: 'open',
      $or: [
        { gameTypeTemplateKey: { $in: ['JODI', 'HALF_SANGAM_A', 'HALF_SANGAM_B', 'FULL_SANGAM'] } },
        { gameTypeCodeSnapshot: { $in: ['JODI', 'HS_A', 'HS_B', 'FS'] } },
      ],
    });
  }

  /**
   * Aggregated exposure summary for simulation at scale.
   * Returns totals + per-selection payout exposure in one DB roundtrip.
   */
  async getPendingExposureSummary(sessionId, betMode) {
    const normalizedSessionId = typeof sessionId === 'string'
      ? new mongoose.Types.ObjectId(sessionId)
      : sessionId;

    const [summary = {}] = await this.model.aggregate([
      {
        $match: {
          sessionId: normalizedSessionId,
          status: BET_STATUS.PENDING,
          ...(betMode ? { betMode } : {}),
        },
      },
      {
        $project: {
          selection: 1,
          amount: 1,
          potentialPayout: { $multiply: ['$amount', '$oddsSnapshot'] },
        },
      },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalCollection: { $sum: '$amount' },
                totalBets: { $sum: 1 },
              },
            },
          ],
          bySelection: [
            {
              $group: {
                _id: '$selection',
                totalAmount: { $sum: '$amount' },
                totalPotentialPayout: { $sum: '$potentialPayout' },
                betCount: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    return {
      totals: summary.totals?.[0] || { totalCollection: 0, totalBets: 0 },
      bySelection: summary.bySelection || [],
    };
  }

  /**
   * User bet history
   */
  async findByUser(userId, page = 1, limit = 20, filters = {}) {
    return await this.findByFilter({ userId, ...filters }, page, limit);
  }

  /**
   * Bulk settle bets
   */
  async bulkUpdateStatus(betIds, status, session = null) {
    return await this.model.updateMany(
      { _id: { $in: betIds } },
      { status },
      { session },
    );
  }

  async getUserBetStats(userId) {
    const [stats = {}] = await this.model.aggregate([
      {
        $match: {
          userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId,
          status: { $ne: BET_STATUS.CANCELLED },
        },
      },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalWagered: { $sum: '$amount' },
          totalWinnings: {
            $sum: {
              $cond: [{ $eq: ['$status', BET_STATUS.WON] }, '$payout', 0],
            },
          },
          totalLosses: {
            $sum: {
              $cond: [{ $eq: ['$status', BET_STATUS.LOST] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    return {
      totalBets: stats.totalBets || 0,
      totalWagered: stats.totalWagered || 0,
      totalWinnings: stats.totalWinnings || 0,
      totalLosses: stats.totalLosses || 0,
    };
  }

  async findOneByUserAndId(userId, betId, session = null) {
    let query = this.model.findOne({
      _id: betId,
      userId,
    });

    if (session) {
      query = query.session(session);
    }

    return query;
  }

  async aggregateReport(pipeline = []) {
    return this.model.aggregate(pipeline);
  }

  async countBySessionIds(sessionIds = []) {
    const normalizedIds = Array.isArray(sessionIds) ? sessionIds.filter(Boolean) : [];
    if (normalizedIds.length === 0) {
      return [];
    }

    return this.model.aggregate([
      {
        $match: {
          sessionId: { $in: normalizedIds },
        },
      },
      {
        $group: {
          _id: '$sessionId',
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async findLeanByIds(ids = [], projection = null) {
    const normalizedIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (normalizedIds.length === 0) {
      return [];
    }

    let query = this.model.find({ _id: { $in: normalizedIds } });
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  /**
   * Find bets by session with user population for admin bid history.
   */
  async findBySessionWithUser(sessionId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const filter = {
      sessionId,
      status: { $ne: BET_STATUS.CANCELLED },
    };
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('userId', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  /**
   * Find cancelled/reverted bets by session with user population.
   */
  async findRevertedBySessionWithUser(sessionId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const query = {
      sessionId,
      status: BET_STATUS.CANCELLED,
    };
    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .populate('userId', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.model.countDocuments(query),
    ]);
    return { items, total };
  }

  // ── Revert batch helpers ───────────────────────────────────────────────────────────────

  /**
   * Count PENDING bets in a session/mode scope.
   * Used for preflight validation before creating a RevertBatch.
   */
  async countEligibleForRevert(sessionId, betMode = null) {
    const query = {
      sessionId,
      status: BET_STATUS.PENDING,
      revertBatchId: null, // not already reverted
    };
    if (betMode) {
      query.betMode = betMode;
    }
    return this.model.countDocuments(query);
  }

  /**
   * Fetch one chunk of PENDING, not-yet-reverted bets starting after
   * `afterCursor` (an _id string).  Returns lean documents.
   *
   * WHY cursor-based pagination instead of skip/limit:
   *   skip() on large collections is O(n) in MongoDB — scanning every doc
   *   up to the skip point.  Using the last processed _id as a cursor means
   *   the query always uses the _id index and is O(chunk size) regardless of
   *   how far into the batch we are.  This is essential for 10 000-bet batches.
   *
   * @param {string}      sessionId
   * @param {string|null} betMode      - 'open' | 'close' | null
   * @param {string|null} afterCursor  - last processed _id (null = start)
   * @param {number}      chunkSize
   */
  async findChunkForRevert(sessionId, betMode, afterCursor, chunkSize = 100) {
    const query = {
      sessionId,
      status: BET_STATUS.PENDING,
      revertBatchId: null,
    };
    if (betMode) {
      query.betMode = betMode;
    }
    if (afterCursor) {
      query._id = { $gt: afterCursor };
    }

    return this.model
      .find(query)
      .sort({ _id: 1 }) // ascending _id keeps cursor stable
      .limit(chunkSize)
      .lean();
  }

  /**
   * Atomically mark a bet as reverted if (and ONLY if) it has not been
   * reverted before.  Returns the updated document, or null if the guard
   * condition was already met (duplicate-refund prevention).
   *
   * WHY conditional update instead of read-then-write:
   *   A worker could crash between reading 'revertBatchId: null' and writing
   *   the batch id.  With a conditional update the atomicity is in MongoDB
   *   itself, not in application code.  If another worker already set
   *   revertBatchId the update matches 0 documents and returns null,
   *   signalling 'skip' without any double-refund occurring.
   */
  async atomicMarkReverted(betId, revertData, session = null) {
    const { revertBatchId, revertedAt, revertedBy, revertReason, refundTransactionId } = revertData;
    const query = this.model.findOneAndUpdate(
      {
        _id: betId,
        status: BET_STATUS.PENDING, // only pending bets may be reverted
        revertBatchId: null,         // double-refund guard
      },
      {
        $set: {
          status: BET_STATUS.CANCELLED,
          revertBatchId,
          revertedAt,
          revertedBy,
          revertReason,
          refundTransactionId,
        },
      },
      { new: true },
    );
    if (session) {
      query.session(session);
    }
    return query;
  }

  /**
   * Conditionally delete a pending bet that has NOT been reverted.
   * Returns the deleted document, or null if the guard condition failed
   * (bet already deleted/reverted or not in pending state).
   *
   * WHY conditional delete instead of read-then-delete:
   *   Provides the same double-guard as atomicMarkReverted but removes
   *   the document entirely — used in the new revert flow where all
   *   traces of the bet are to be eliminated.
   */
  async deleteBet(betId, session = null) {
    const query = this.model.findOneAndDelete({
      _id: betId,
      status: BET_STATUS.PENDING,
      revertBatchId: null,
    });
    if (session) {
      query.session(session);
    }
    return query;
  }
}

module.exports = BetRepository;

