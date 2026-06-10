/**
 * Game Session Service
 * Handles all game session business logic and event scheduling
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const { setTimeout } = require('timers');
const { DateTime } = require('luxon');
const { RepositoryFactory } = require('@infra/database');
const EventTaskRegistry = require('../../infrastructure/queue/eventTaskRegistry');
const {
  getSessionDateIST,
  getSessionDateForDateIST,
  buildTimeOnSessionDate,
  isAfterIST,
  BUSINESS_TIMEZONE,
} = require('@utils/timezoneHelper');
const eventTaskTypes = require('@config/constants/eventTaskTypes');
const { SESSION_PHASE, SESSION_STATUS, BET_MODE, MARKET_STATUS, SETTLEMENT_STATUS } = require('@config/constants/domain');
const { ValidationError, NotFoundError, AppError, ConflictError } = require('@utils/errors');
const logger = require('@utils/logger');
const { isMarketActiveOnDay } = require('@domain/markets/marketSchedule');
const { compareBySessionCloseTime } = require('@domain/markets/marketSessionOrdering');
const { mapUserSessionDetails, mapAdminSessionDetails } = require('./sessions.mapper');

const gameSessionRepo = RepositoryFactory.getRepository('GameSession');
const marketRepo = RepositoryFactory.getRepository('Market');
const betRepository = RepositoryFactory.getRepository('Bet');
const globalConfigRepo = RepositoryFactory.getRepository('GlobalConfig');

const dailySessionJobState = {
  currentJobId: 0,
  running: false,
  startedAt: null,
  finishedAt: null,
  result: null,
  error: null,
};

const cloneDailySessionJobState = () => ({
  running: dailySessionJobState.running,
  startedAt: dailySessionJobState.startedAt,
  finishedAt: dailySessionJobState.finishedAt,
  result: dailySessionJobState.result,
  error: dailySessionJobState.error,
});

const getDeclarationConfig = async () => {
  const config = await globalConfigRepo.findOne({});
  return {
    graceHours: config?.resultDeclarationGraceHours ?? 5,
  };
};

const calculateSessionDeclarationDeadline = async (closeTime) => {
  const { graceHours } = await getDeclarationConfig();

  return DateTime
    .fromJSDate(closeTime, { zone: BUSINESS_TIMEZONE })
    .plus({ hours: graceHours })
    .toJSDate();
};

const WARNING_CODE = Object.freeze({
  SESSION_CANCELLED_WITH_BETS: 'SESSION_CANCELLED_WITH_BETS',
  SESSION_CANCELLED_AFTER_SETTLEMENT: 'SESSION_CANCELLED_AFTER_SETTLEMENT',
});

const buildCancellationPayloadHash = ({ reason, force }) => crypto
  .createHash('sha256')
  .update(JSON.stringify({ reason: reason || '', force: !!force }))
  .digest('hex');

const buildSessionCancelledWithBetsWarning = (sessionId) => ({
  code: WARNING_CODE.SESSION_CANCELLED_WITH_BETS,
  message: 'Session was cancelled but bets exist and refunds have not been executed.',
  severity: 'high',
  actionRequired: true,
  recommendedAction: 'Review session bets and run explicit revert or approved manual correction.',
  referenceSessionId: sessionId ? String(sessionId) : null,
});

const buildSessionCancelledAfterSettlementWarning = (sessionId) => ({
  code: WARNING_CODE.SESSION_CANCELLED_AFTER_SETTLEMENT,
  message: 'Session was cancelled after settlement. Financial postings remain and require manual correction.',
  severity: 'high',
  actionRequired: true,
  recommendedAction: 'Use approved manual financial correction workflow. No automatic rollback is allowed.',
  referenceSessionId: sessionId ? String(sessionId) : null,
});

const buildSessionGameTypeSnapshots = (market = {}) => (
  (Array.isArray(market.gameTypes) ? market.gameTypes : [])
    .filter((entry) => entry?.gameTypeId && entry?.gameTypeId?.code)
    .map((entry) => ({
      gameTypeId: entry.gameTypeId._id || entry.gameTypeId,
      code: entry.gameTypeId.code,
      name: entry.gameTypeId.name,
      betPhaseType: entry.gameTypeId.betPhaseType,
      payoutMultiplier: entry.payoutMultiplier ?? entry.gameTypeId.payoutMultiplier ?? null,
      minBet: entry.minBet ?? entry.gameTypeId.minBet ?? null,
      maxBet: entry.maxBet ?? entry.gameTypeId.maxBet ?? null,
      status: entry.status || MARKET_STATUS.ACTIVE,
    }))
);

const mapCancellationResponse = ({ session, hasBets }) => ({
  sessionId: String(session._id),
  status: session.status,
  phase: session.phase,
  financialActionTaken: false,
  hasBets,
  warning: session.warning ? session.warning.message : null,
});

const isUserVisibleSession = (session) => session?.status === SESSION_STATUS.ACTIVE;

const ensureSessionCanTransition = (session, nextPhase) => {
  const currentPhase = session.phase;
  const hasOpen =
    !!session.result?.openPana
    && session.result?.openDigit !== null
    && session.result?.openDigit !== undefined;
  const hasClose =
    !!session.result?.closePana
    && session.result?.closeDigit !== null
    && session.result?.closeDigit !== undefined;

  if (nextPhase === SESSION_PHASE.CLOSE_RUNNING && currentPhase !== SESSION_PHASE.OPEN_RUNNING) {
    throw new ValidationError(`Invalid phase transition: ${currentPhase} -> ${nextPhase}`);
  }

  if (nextPhase === SESSION_PHASE.MARKET_CLOSED && currentPhase !== SESSION_PHASE.CLOSE_RUNNING) {
    throw new ValidationError(`Invalid phase transition: ${currentPhase} -> ${nextPhase}`);
  }

  if (nextPhase === SESSION_PHASE.SETTLED) {
    if (currentPhase !== SESSION_PHASE.MARKET_CLOSED) {
      throw new ValidationError(`Invalid phase transition: ${currentPhase} -> ${nextPhase}`);
    }

    if (!hasOpen || !hasClose) {
      throw new ValidationError('Both open and close results must be declared before settlement');
    }
  }
};

const transitionSessionPhase = async (session, nextPhase, txSession = null) => {
  if (!session || !session._id) {
    throw new ValidationError('Invalid session data for phase transition');
  }

  if (session.phase === nextPhase) {
    return session;
  }

  ensureSessionCanTransition(session, nextPhase);

  const updated = await gameSessionRepo.setPhase(session._id, nextPhase, txSession);
  if (!updated) {
    throw new ValidationError('Unable to update session phase');
  }

  logger.info({
    message: 'session.phase_changed',
    sessionId: String(session._id),
    fromPhase: session.phase,
    toPhase: nextPhase,
  });

  return updated;
};

/**
 * Create daily game sessions for all active markets.
 */
const createDailySessionsForAllMarkets = async () => {
  try {
    const markets = await marketRepo.findActiveMarkets({ status: MARKET_STATUS.ACTIVE });

    if (markets.length === 0) {
      logger.warn({ message: 'No active markets found for daily session creation' });
      return { created: 0, skipped: 0, errors: [] };
    }

    let created = 0;
    let skipped = 0;
    const errors = [];

    const settled = await Promise.allSettled(markets.map((market) => createSessionForMarket(market)));

    settled.forEach((entry, idx) => {
      if (entry.status === 'fulfilled') {
        created += 1;
        return;
      }

      const err = entry.reason;
      if (err?.message?.includes('exists for today') || err?.message?.includes('No session scheduled for today')) {
        skipped += 1;
        return;
      }

      const market = markets[idx];
      errors.push({
        marketId: market?._id || null,
        marketName: market?.name || null,
        error: err?.message || 'Unknown error',
      });
    });

    logger.info({
      message: 'Daily session creation complete',
      created,
      skipped,
      errorCount: errors.length,
    });

    return { created, skipped, errors };
  } catch (err) {
    logger.error({
      message: 'Error creating daily sessions',
      error: err,
    });
    throw err;
  }
};

const startDailySessionCreationInBackground = () => {
  if (dailySessionJobState.running) {
    return {
      started: false,
      message: 'Job already running',
      statusUrl: '/admin/sessions/daily/status',
    };
  }

  const jobId = dailySessionJobState.currentJobId + 1;
  dailySessionJobState.currentJobId = jobId;
  dailySessionJobState.running = true;
  dailySessionJobState.startedAt = new Date();
  dailySessionJobState.finishedAt = null;
  dailySessionJobState.result = null;
  dailySessionJobState.error = null;

  setTimeout(async () => {
    try {
      const result = await createDailySessionsForAllMarkets();
      if (dailySessionJobState.currentJobId === jobId) {
        dailySessionJobState.result = result;
      }
    } catch (err) {
      if (dailySessionJobState.currentJobId === jobId) {
        dailySessionJobState.error = err?.message || 'Unknown error';
      }
    } finally {
      if (dailySessionJobState.currentJobId === jobId) {
        dailySessionJobState.running = false;
        dailySessionJobState.finishedAt = new Date();
      }
    }
  }, 0);

  return {
    started: true,
    message: 'Job queued',
    statusUrl: '/admin/sessions/daily/status',
  };
};

const getDailySessionCreationStatus = () => cloneDailySessionJobState();

const getAdminSessionsOverview = async (dateStr = null) => {
  let sessions;
  if (dateStr) {
    sessions = await getSessionsByDateWithMarket(dateStr);
  } else {
    sessions = await getTodaysSessions();
    const sessionMap = new Map(
      (sessions || []).map((s) => [String(s.marketId), s]),
    );
    const markets = await marketRepo.find({
      status: MARKET_STATUS.ACTIVE,
    });
    sessions = markets.map((market) => {
      const session = sessionMap.get(String(market._id));
      if (session) {
        return {
          ...mapAdminSessionDetails(session, market),
          createdAt: session.createdAt,
        };
      }
      return {
        sessionId: null,
        marketId: String(market._id),
        marketName: market.name,
        phase: null,
        status: null,
        openTime: null,
        closeTime: null,
        cancellationReason: null,
        cancelledAt: null,
        cancelledBy: null,
        result: { openPana: null, closePana: null, openDigit: null, closeDigit: null },
        currentResult: null,
        settledResult: null,
        resultRevision: null,
        settledResultRevision: null,
        settlementStatus: null,
        isFinanciallyConsistent: null,
        warning: null,
        lastSettlementJobId: null,
        resultDeclarationAvailableTill: null,
        createdAt: null,
      };
    }).sort((left, right) => compareBySessionCloseTime(left, right, {
      getName: (session) => session.marketName,
    }));
  }

  return sessions;
};

const areAllSessionsResultsDeclared = async () => {
  const now = new Date();

  const pending = await gameSessionRepo.find({
    status: SESSION_STATUS.ACTIVE,
    resultDeclarationAvailableTill: { $gte: now },
    $or: [
      { 'result.openPana': null },
      { 'result.closePana': null },
    ],
  });

  return pending.length === 0;
};

/**
 * Create a session for a specific market.
 */
const createSessionForMarket = async (market) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sessionDate = getSessionDateForDateIST();
    const existingSession = await gameSessionRepo.findOne(
      {
        marketId: market._id,
        sessionDate,
      },
      session,
    );

    if (existingSession) {
      throw new Error('Session already exists for today');
    }

    if (!isMarketActiveOnDay(market.schedule, sessionDate)) {
      throw new Error('No session scheduled for today');
    }

    const openTime = buildTimeOnSessionDate(sessionDate, market.openTime);
    const closeTime = buildTimeOnSessionDate(sessionDate, market.closeTime);

    if (openTime <= sessionDate || closeTime <= openTime) {
      throw new Error('Invalid market schedule for session day');
    }

    const resultDeclarationAvailableTill = await calculateSessionDeclarationDeadline(closeTime);

    const newSession = await gameSessionRepo.create(
      {
        marketId: market._id,
        sessionDate,
        openTime,
        closeTime,
        openTimeSnapshot: market.openTime,
        closeTimeSnapshot: market.closeTime,
        status: SESSION_STATUS.ACTIVE,
        phase: SESSION_PHASE.OPEN_RUNNING,
        gameTypesSnapshot: buildSessionGameTypeSnapshots(market),
        resultDeclarationAvailableTill,
        result: {
          openPana: null,
          closePana: null,
          openDigit: null,
          closeDigit: null,
        },
      },
      session,
    );

    try {
      await EventTaskRegistry.scheduleTask({
        type: eventTaskTypes.MARKET_PHASE_CHANGE,
        scheduledAt: openTime,
        payload: {
          sessionId: newSession._id,
          marketId: market._id,
          marketName: market.name,
        },
        priority: 3,
        maxAttempts: 2,
      });
    } catch (err) {
      logger.warn({
        message: 'Failed to schedule MARKET_PHASE_CHANGE task',
        marketName: market.name,
        error: err,
      });
    }

    try {
      await EventTaskRegistry.scheduleTask({
        type: eventTaskTypes.MARKET_LOCK,
        scheduledAt: closeTime,
        payload: {
          sessionId: newSession._id,
          marketId: market._id,
          marketName: market.name,
        },
        priority: 3,
        maxAttempts: 3,
      });
    } catch (err) {
      logger.warn({
        message: 'Failed to schedule MARKET_LOCK task',
        marketName: market.name,
        error: err,
      });
    }

    await session.commitTransaction();

    logger.info({
      message: 'Session created for market',
      marketId: String(market._id),
      marketName: market.name,
      sessionId: String(newSession._id),
    });

    return newSession;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * Get session with validation.
 */
const getSessionById = async (sessionId) => {
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
    throw new ValidationError('Invalid session ID');
  }

  try {
    return await gameSessionRepo.findById(sessionId);
  } catch {
    throw new NotFoundError('Session not found');
  }
};

/**
 * Get active session for a market (betting-eligible).
 */
const getActiveSessionForMarket = async (marketId) => {
  if (!marketId || !mongoose.Types.ObjectId.isValid(marketId)) {
    throw new ValidationError('Invalid market ID');
  }

  const session = await gameSessionRepo.findOne({
    marketId,
    status: SESSION_STATUS.ACTIVE,
    phase: { $in: [SESSION_PHASE.OPEN_RUNNING, SESSION_PHASE.CLOSE_RUNNING] },
  });

  if (!session) {
    throw new NotFoundError('No active session for this market');
  }

  return session;
};

/**
 * Validate if betting is allowed for a session.
 */
const validateBettingEligibility = (gameSession, betMode) => {
  const sessionStatus = gameSession.status || SESSION_STATUS.ACTIVE;
  if (sessionStatus !== SESSION_STATUS.ACTIVE) {
    throw new ValidationError('Session is not active. Betting is not allowed.');
  }

  if (![SESSION_PHASE.OPEN_RUNNING, SESSION_PHASE.CLOSE_RUNNING].includes(gameSession.phase)) {
    throw new ValidationError('Market is closed. No more bets allowed.');
  }

  if (betMode === BET_MODE.OPEN) {
    if (gameSession.openResultDeclared === true) {
      throw new ValidationError('Open betting has ended. Cannot place open bets after open result.');
    }
    if (isAfterIST(gameSession.openTime)) {
      throw new ValidationError('Open betting period has ended');
    }
    return;
  }

  if (betMode === BET_MODE.CLOSE) {
    if (isAfterIST(gameSession.closeTime)) {
      throw new ValidationError('Close betting period has ended');
    }
    return;
  }

  throw new ValidationError('Invalid bet mode. Must be "open" or "close"');
};

/**
 * Lock session manually/system driven.
 */
const lockSession = async (sessionId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const gameSession = await getSessionById(sessionId);

    const sessionStatus = gameSession.status || SESSION_STATUS.ACTIVE;
    if (sessionStatus !== SESSION_STATUS.ACTIVE) {
      throw new ValidationError(`Cannot lock session with status ${sessionStatus}`);
    }

    if (![SESSION_PHASE.OPEN_RUNNING, SESSION_PHASE.CLOSE_RUNNING, SESSION_PHASE.MARKET_CLOSED].includes(gameSession.phase)) {
      throw new ValidationError(`Cannot lock/unlock session in ${gameSession.phase} phase`);
    }

    const lockedSession = await gameSessionRepo.lockSession(sessionId, session);
    if (!lockedSession) {
      throw new ValidationError('Failed to lock session');
    }

    await session.commitTransaction();

    logger.info({
      message: 'Session locked',
      sessionId: String(sessionId),
    });

    return lockedSession;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * Get all sessions for a specific date.
 */
const getSessionsByDate = async (date) => {
  const sessionDate = getSessionDateForDateIST(new Date(date));

  return gameSessionRepo.find({ sessionDate });
};

/**
 * Get today's sessions.
 */
const getTodaysSessions = async () => {
  const sessionDate = getSessionDateIST();
  return gameSessionRepo.find({ sessionDate });
};

const cancelSession = async ({
  sessionId,
  reason,
  idempotencyKey,
  force = false,
  adminUserId = null,
}) => {
  if (!idempotencyKey) {
    throw new ValidationError('idempotencyKey is required');
  }

  if (!reason || !String(reason).trim()) {
    throw new ValidationError('reason is required');
  }

  const currentSession = await getSessionById(sessionId);
  const payloadHash = buildCancellationPayloadHash({ reason, force });
  const previousRequest = currentSession.lastCancellationRequest || null;

  if (previousRequest?.idempotencyKey === idempotencyKey) {
    if (previousRequest.payloadHash !== payloadHash) {
      throw new ConflictError('idempotencyKey was already used with a different cancellation payload');
    }

    const hasBets = await betRepository.count({ sessionId: currentSession._id }) > 0;
    return mapCancellationResponse({ session: currentSession, hasBets });
  }

  if (currentSession.settlementStatus === SETTLEMENT_STATUS.PROCESSING) {
    throw new AppError('Session cannot be cancelled while settlement is processing.', {
      code: 'SETTLEMENT_IN_PROGRESS',
      statusCode: 409,
    });
  }

  if (force) {
    throw new ValidationError('force cancellation is not supported');
  }

  if (currentSession.status === SESSION_STATUS.CANCELLED) {
    const hasBets = await betRepository.count({ sessionId: currentSession._id }) > 0;
    return mapCancellationResponse({ session: currentSession, hasBets });
  }

  const hasBets = await betRepository.count({ sessionId: currentSession._id }) > 0;
  const now = new Date();
  const isAfterSettlement = currentSession.phase === SESSION_PHASE.SETTLED
    || currentSession.status === SESSION_STATUS.SETTLED;

  const updates = {
    status: SESSION_STATUS.CANCELLED,
    phase: isAfterSettlement ? currentSession.phase : SESSION_PHASE.MARKET_CLOSED,
    cancelledAt: now,
    cancelledBy: adminUserId,
    cancellationReason: String(reason).trim(),
    lastCancellationRequest: {
      idempotencyKey,
      payloadHash,
      requestedAt: now,
    },
  };

  if (isAfterSettlement) {
    updates.isFinanciallyConsistent = false;
    updates.financialInconsistencyReason = WARNING_CODE.SESSION_CANCELLED_AFTER_SETTLEMENT;
    updates.financialInconsistencyDetectedAt = now;
    updates.warning = buildSessionCancelledAfterSettlementWarning(currentSession._id);
  } else if (hasBets) {
    updates.isFinanciallyConsistent = false;
    updates.financialInconsistencyReason = WARNING_CODE.SESSION_CANCELLED_WITH_BETS;
    updates.financialInconsistencyDetectedAt = now;
    updates.warning = buildSessionCancelledWithBetsWarning(currentSession._id);
  } else {
    updates.isFinanciallyConsistent = true;
    updates.financialInconsistencyReason = null;
    updates.financialInconsistencyDetectedAt = null;
    updates.warning = null;
  }

  const updatedSession = await gameSessionRepo.cancelSession(currentSession._id, updates);
  const resolvedSession = updatedSession || await getSessionById(currentSession._id);

  logger.info({
    message: 'session.cancelled',
    sessionId: String(resolvedSession._id),
    adminUserId: adminUserId ? String(adminUserId) : null,
    hasBets,
    phase: resolvedSession.phase,
    status: resolvedSession.status,
  });

  return mapCancellationResponse({ session: resolvedSession, hasBets });
};

/**
 * User-safe game results by date.
 */
const getGameResultsByDate = async ({ date, marketId }) => {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
  }

  const parsed = DateTime.fromISO(date, { zone: BUSINESS_TIMEZONE });
  if (!parsed.isValid) {
    throw new ValidationError('Invalid date');
  }

  const filter = {
    sessionDate: {
      $gte: parsed.startOf('day').toJSDate(),
      $lte: parsed.endOf('day').toJSDate(),
    },
    status: SESSION_STATUS.ACTIVE,
  };

  if (marketId) {
    if (!mongoose.Types.ObjectId.isValid(marketId)) {
      throw new ValidationError('Invalid marketId');
    }
    filter.marketId = marketId;
  }

  const sessions = await gameSessionRepo.findLean(filter);
  if (!sessions || sessions.length === 0) {
    return [];
  }

  const marketIds = [...new Set(sessions.map((sess) => String(sess.marketId)))];
  const markets = await marketRepo.findLeanByIds(marketIds, 'name');
  const marketMap = Object.fromEntries(markets.map((mkt) => [String(mkt._id), mkt]));

  return sessions.map((sess) => {
    const openDeclared =
      !!sess.result?.openPana
      && sess.result?.openDigit !== null
      && sess.result?.openDigit !== undefined;
    const closeDeclared =
      !!sess.result?.closePana
      && sess.result?.closeDigit !== null
      && sess.result?.closeDigit !== undefined;

    let resultStatus = 'NOT_DECLARED';
    if (sess.phase === SESSION_PHASE.SETTLED) {
      resultStatus = 'SETTLED';
    } else if (openDeclared && closeDeclared) {
      resultStatus = 'FULL_DECLARED';
    } else if (openDeclared) {
      resultStatus = 'OPEN_ONLY';
    }

    return {
      marketId: sess.marketId,
      marketName: marketMap[String(sess.marketId)]?.name || null,
      sessionDate: DateTime.fromJSDate(sess.sessionDate, { zone: BUSINESS_TIMEZONE }).toISODate(),
      phase: sess.phase,
      resultStatus,
      result: {
        openPana: sess.result?.openPana || null,
        openDigit: sess.result?.openDigit ?? null,
        closePana: sess.result?.closePana || null,
        closeDigit: sess.result?.closeDigit ?? null,
      },
    };
  });
};

/**
 * Get market status summary.
 */
const getMarketStatusSummary = async () => {
  const sessions = (await getTodaysSessions()).filter(isUserVisibleSession);
  const markets = await marketRepo.findLeanByIds(
    sessions.map((sess) => sess.marketId),
  );
  const marketMap = Object.fromEntries(
    markets.map((market) => [String(market._id), market]),
  );

  const summary = {
    total: sessions.length,
    openPhase: 0,
    closePhase: 0,
    marketClosed: 0,
    settled: 0,
    markets: [],
  };

  for (const sess of sessions) {
    const market = marketMap[String(sess.marketId)] || null;

    let status = 'unknown';
    if (sess.phase === SESSION_PHASE.SETTLED) {
      status = SESSION_PHASE.SETTLED;
    } else if (isAfterIST(sess.closeTime)) {
      status = 'locked';
    } else if (isAfterIST(sess.openTime)) {
      status = 'in-close';
    } else {
      status = 'in-open';
    }

    if (sess.phase === SESSION_PHASE.OPEN_RUNNING) {
      summary.openPhase += 1;
    } else if (sess.phase === SESSION_PHASE.CLOSE_RUNNING) {
      summary.closePhase += 1;
    } else if (sess.phase === SESSION_PHASE.MARKET_CLOSED) {
      summary.marketClosed += 1;
    } else if (sess.phase === SESSION_PHASE.SETTLED) {
      summary.settled += 1;
    }

    summary.markets.push({
      sessionId: sess._id,
      marketId: sess.marketId,
      marketName: market?.name,
      phase: sess.phase,
      sessionStatus: sess.status,
      status,
      openTime: sess.openTime,
      closeTime: sess.closeTime,
      result: sess.result,
    });
  }

  return summary;
};

/**
 * Helpers for controller-friendly responses (with market names).
 */
const getTodaysSessionsWithMarket = async () => {
  const sessions = await getTodaysSessions();
  if (!sessions || sessions.length === 0) {
    return [];
  }

  const markets = await marketRepo.find({
    _id: { $in: sessions.map((s) => s.marketId) },
  });
  const marketMap = Object.fromEntries(markets.map((m) => [String(m._id), m]));

  return sessions.map((sess) => {
    const market = marketMap[String(sess.marketId)];
    if (isUserVisibleSession(sess)) {
      return {
        ...mapUserSessionDetails(sess, market),
        createdAt: sess.createdAt,
      };
    }
    return {
      sessionId: String(sess._id),
      marketId: String(sess.marketId),
      marketName: market?.name || null,
      phase: sess.phase || 'market_closed',
      status: 'close',
      openTime: sess.openTime || null,
      closeTime: sess.closeTime || null,
      result: sess.result
        ? {
          openPana: sess.result.openPana,
          closePana: sess.result.closePana,
          openDigit: sess.result.openDigit,
          closeDigit: sess.result.closeDigit,
        }
        : { openPana: null, closePana: null, openDigit: null, closeDigit: null },
      currentResult: sess.currentResult || null,
      createdAt: sess.createdAt,
    };
  }).sort((left, right) => compareBySessionCloseTime(left, right, {
    getName: (session) => session.marketName,
  }));
};

const getActiveSessionForMarketDetails = async (marketId) => {
  const session = await getActiveSessionForMarket(marketId);
  const market = await marketRepo.findById(marketId);

  return mapUserSessionDetails(session, market);
};

const getSessionDetailsById = async (sessionId) => {
  const session = await getSessionById(sessionId);
  if (!isUserVisibleSession(session)) {
    throw new NotFoundError('Session not found');
  }

  const market = await marketRepo.findById(session.marketId);

  return {
    ...mapUserSessionDetails(session, market),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
};

const lockSessionWithDetails = async (sessionId) => {
  const lockedSession = await lockSession(sessionId);
  const market = await marketRepo.findById(lockedSession.marketId);

  const isUnlock = lockedSession.phase !== SESSION_PHASE.MARKET_CLOSED;

  return {
    sessionId: lockedSession._id,
    marketName: market?.name,
    phase: lockedSession.phase,
    message: isUnlock ? 'Session unlocked' : 'Session locked - Close phase active',
  };
};

const getSessionsByDateWithMarket = async (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
  }

  const dateObj = new Date(date);
  if (Number.isNaN(dateObj.getTime())) {
    throw new ValidationError('Invalid date');
  }

  const sessions = await getSessionsByDate(dateObj);
  const sessionMap = new Map(
    (sessions || []).map((s) => [String(s.marketId), s]),
  );

  const markets = await marketRepo.find({
    status: MARKET_STATUS.ACTIVE,
  });

  return markets.map((market) => {
    const session = sessionMap.get(String(market._id));
    if (session) {
      return mapAdminSessionDetails(session, market);
    }
    return {
      sessionId: null,
      marketId: String(market._id),
      marketName: market.name,
      phase: null,
      status: null,
      openTime: null,
      closeTime: null,
      cancellationReason: null,
      cancelledAt: null,
      cancelledBy: null,
      result: { openPana: null, closePana: null, openDigit: null, closeDigit: null },
      currentResult: null,
      settledResult: null,
      resultRevision: null,
      settledResultRevision: null,
      settlementStatus: null,
      isFinanciallyConsistent: null,
      warning: null,
      lastSettlementJobId: null,
      resultDeclarationAvailableTill: null,
    };
  }).sort((left, right) => compareBySessionCloseTime(left, right, {
    getName: (session) => session.marketName,
  }));
};

module.exports = {
  createDailySessionsForAllMarkets,
  createSessionForMarket,
  startDailySessionCreationInBackground,
  getDailySessionCreationStatus,
  getAdminSessionsOverview,
  getDeclarationConfig,
  areAllSessionsResultsDeclared,
  transitionSessionPhase,
  getSessionById,
  getActiveSessionForMarket,
  validateBettingEligibility,
  lockSession,
  getSessionsByDate,
  getTodaysSessions,
  cancelSession,
  getGameResultsByDate,
  getMarketStatusSummary,
  getTodaysSessionsWithMarket,
  getActiveSessionForMarketDetails,
  getSessionDetailsById,
  lockSessionWithDetails,
  getSessionsByDateWithMarket,
  mapAdminSessionDetails,
};

