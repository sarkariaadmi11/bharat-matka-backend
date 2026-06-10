// repositories/gameSessionRepository.js
const BaseRepository = require('./baseRepository');
const { GameSession } = require('@infra/models');
const { SESSION_PHASE, SESSION_STATUS } = require('@config/constants/domain');
const { buildResultState, getCurrentResult } = require('@domain/results/resultState');
const { DateTime } = require('luxon');
const { BUSINESS_TIMEZONE } = require('@utils/timezoneHelper');

class GameSessionRepository extends BaseRepository {
  constructor() {
    super(GameSession);
  }

  async findLeanById(id, projection = null) {
    let query = this.model.findById(id);
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
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

  async findTodayByMarketIds(marketIds = [], sessionDate) {
    const normalizedIds = Array.isArray(marketIds) ? marketIds.filter(Boolean) : [];
    if (normalizedIds.length === 0) {
      return [];
    }

    return this.model.find({
      marketId: { $in: normalizedIds },
      sessionDate,
    }).lean();
  }

  async findLeanByMarketIds(marketIds = [], projection = null) {
    const normalizedIds = Array.isArray(marketIds) ? marketIds.filter(Boolean) : [];
    if (normalizedIds.length === 0) {
      return [];
    }

    let query = this.model.find({ marketId: { $in: normalizedIds } });
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  async findOneLean(filter, projection = null) {
    let query = this.model.findOne(filter);
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  async findLean(filter = {}, projection = null) {
    let query = this.model.find(filter);
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  async findOneAndUpdateByFilter(filter, update, options = {}) {
    return this.model.findOneAndUpdate(
      filter,
      update,
      {
        new: true,
        ...options,
      },
    );
  }

  async aggregateSessions(pipeline = []) {
    return this.model.aggregate(pipeline);
  }

  async findByMarketAndDateLean(marketId, sessionDate, projection = null) {
    const businessDay = DateTime.fromISO(sessionDate, { zone: BUSINESS_TIMEZONE }).startOf('day');
    const filter = {
      marketId,
      sessionDate: {
        $gte: businessDay.toJSDate(),
        $lte: businessDay.endOf('day').toJSDate(),
      },
    };

    let query = this.model.findOne(filter);
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  async findSessionIdsByDateRange({ from, to, marketId = null }) {
    const filter = {
      sessionDate: {
        $gte: from,
        $lte: to,
      },
    };

    if (marketId) {
      filter.marketId = marketId;
    }

    const rows = await this.model.find(filter).select('_id').lean();
    return rows.map((row) => String(row._id));
  }

  async findSessionTruthMapByIds(ids = []) {
    const normalizedIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (normalizedIds.length === 0) {
      return new Map();
    }

    const rows = await this.model.find({ _id: { $in: normalizedIds } })
      .select('_id sessionDate marketId currentResult settledResult isFinanciallyConsistent warning settlementStatus')
      .lean();

    return new Map(rows.map((row) => [String(row._id), row]));
  }

  /**
   * Create daily session for a market
   * Called by CRON / scheduler
   */
  async createDailySession(data, session = null) {
    return await this.create(data, session);
  }

  /**
   * Get active (bettable) session for a market
   */
  async findActiveSession(marketId) {
    return await this.model.findOne({
      marketId,
      status: SESSION_STATUS.ACTIVE,
      phase: { $in: [SESSION_PHASE.OPEN_RUNNING, SESSION_PHASE.CLOSE_RUNNING] },
    });
  }

  /**
   * LOCK SESSION (No changes needed)
   * Prevents new bets from being placed
   */
  async lockSession(sessionId, session = null) {
    const sessionDoc = await this.model.findById(sessionId);
    if (!sessionDoc || sessionDoc.status !== SESSION_STATUS.ACTIVE) {
      return null;
    }

    let targetPhase;
    if (sessionDoc.phase === SESSION_PHASE.MARKET_CLOSED) {
      const now = new Date();
      targetPhase = now < new Date(sessionDoc.openTime)
        ? SESSION_PHASE.OPEN_RUNNING
        : SESSION_PHASE.CLOSE_RUNNING;
    } else if ([SESSION_PHASE.OPEN_RUNNING, SESSION_PHASE.CLOSE_RUNNING].includes(sessionDoc.phase)) {
      targetPhase = SESSION_PHASE.MARKET_CLOSED;
    } else {
      return null;
    }

    return await this.model.findOneAndUpdate(
      { _id: sessionId, status: SESSION_STATUS.ACTIVE },
      { phase: targetPhase },
      { new: true, session },
    );
  }

  /**
   * Set session phase explicitly (used by scheduler handlers)
   */
  async setPhase(sessionId, phase, session = null) {
    return await this.model.findOneAndUpdate(
      {
        _id: sessionId,
        status: SESSION_STATUS.ACTIVE,
      },
      { phase },
      { new: true, session },
    );
  }

  async cancelSession(sessionId, updates = {}, session = null) {
    return this.model.findOneAndUpdate(
      {
        _id: sessionId,
        status: { $ne: SESSION_STATUS.CANCELLED },
      },
      {
        $set: updates,
      },
      {
        new: true,
        session,
      },
    );
  }

  /**
   * Declare OPEN Result
   * CRITICAL: This does NOT change phase from 'open' to 'close'
   * - Updates result.openPana & result.openDigit with declared values
   * - Sets openResultDeclared = true (enables CLOSE bets)
   * - Phase STAYS 'open' (still accepting CLOSE bets until closeTime)
   * - Frontend transitions: "Bet Running" â†’ "Close Running"
   *
   * Timeline: 7:15 PM (in Kalyani_Night example)
   */
  async declareOpenResult(sessionId, openResultData, session = null) {
    // openResultData = { openPana: '123', openDigit: '6' }
    return await this.model.findOneAndUpdate(
      {
        _id: sessionId,
        phase: { $in: [SESSION_PHASE.OPEN_RUNNING, SESSION_PHASE.CLOSE_RUNNING, SESSION_PHASE.MARKET_CLOSED] },
        openResultDeclared: { $ne: true },
      },
      {
        $set: {
          'result.openPana': openResultData.openPana,
          'result.openDigit': openResultData.openDigit,
          'result.openDeclaredAt': new Date(),
          'currentResult.openPana': openResultData.openPana,
          'currentResult.openDigit': openResultData.openDigit,
          'currentResult.openDeclaredAt': new Date(),
          openResultDeclared: true,
          // Phase REMAINS 'open' - close bets now accepted
        },
        $inc: {
          resultRevision: 1,
        },
      },
      { new: true, session },
    );
  }

  /**
   * Declare CLOSE Result (Final Settlement)
   * - ONLY callable when phase is 'close' (market already locked at closeTime)
   * - Updates result.closePana & result.closeDigit
   * - Changes phase from 'close' â†’ 'settled' (final state)
   * - Settlement with payout execution happens after this
   *
   * Timeline: 8:15 PM (in Kalyani_Night example)
   */
  async declareCloseResult(sessionId, closeResultData, session = null) {
    // closeResultData = { closePana: '567', closeDigit: '8' }
    return await this.model.findOneAndUpdate(
      {
        _id: sessionId,
        phase: { $in: [SESSION_PHASE.CLOSE_RUNNING, SESSION_PHASE.MARKET_CLOSED] },
        'result.closeDigit': null,
      },
      {
        $set: {
          'result.closePana': closeResultData.closePana,
          'result.closeDigit': closeResultData.closeDigit,
          'result.closeDeclaredAt': new Date(),
          'currentResult.closePana': closeResultData.closePana,
          'currentResult.closeDigit': closeResultData.closeDigit,
          'currentResult.closeDeclaredAt': new Date(),
        },
        $inc: {
          resultRevision: 1,
        },
      },
      { new: true, session },
    );
  }

  async updateResultState(sessionId, updates = {}, session = null) {
    return this.model.findByIdAndUpdate(
      sessionId,
      {
        $set: updates,
      },
      {
        new: true,
        session,
      },
    );
  }

  async syncResultState(sessionId, session = null) {
    const gameSession = await this.findById(sessionId, session);
    const resultState = buildResultState(gameSession);

    return this.updateResultState(
      sessionId,
      {
        settledResult: resultState.settledResult,
        currentResult: resultState.currentResult,
        result: getCurrentResult(gameSession),
        settlementStatus: resultState.settlementStatus,
        isFinanciallyConsistent: resultState.isFinanciallyConsistent,
        financialInconsistencyReason: resultState.financialInconsistencyReason,
        financialInconsistencyDetectedAt: resultState.financialInconsistencyDetectedAt,
        warning: resultState.warning,
      },
      session,
    );
  }

  async markSettled(sessionId, session = null) {
    return await this.model.findOneAndUpdate(
      {
        _id: sessionId,
        phase: { $ne: SESSION_PHASE.SETTLED },
      },
      {
        $set: {
          status: SESSION_STATUS.SETTLED,
          phase: SESSION_PHASE.SETTLED,
          settledAt: new Date(),
        },
      },
      { new: true, session },
    );
  }

  /**
   * Declare result (Admin action)
   * Idempotent-safe
   */
  async declareResult(sessionId, result, session = null) {
    return await this.model.findOneAndUpdate(
      {
        _id: sessionId,
        status: SESSION_STATUS.ACTIVE,
        phase: SESSION_PHASE.MARKET_CLOSED,
        result: null,
      },
      {
        result,
        status: SESSION_STATUS.SETTLED,
        phase: SESSION_PHASE.SETTLED,
        settledAt: new Date(),
      },
      { new: true, session },
    );
  }
}

module.exports = GameSessionRepository;

