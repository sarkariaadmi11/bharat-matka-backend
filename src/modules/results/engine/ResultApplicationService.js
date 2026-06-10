const mongoose = require('mongoose');
const { RepositoryFactory } = require('@infra/database');
const eventTaskTypes = require('@config/constants/eventTaskTypes');
const {
  SESSION_PHASE,
  SESSION_STATUS,
  SESSION_PHASE_ALIAS,
  BET_MODE,
  SETTLEMENT_STATUS,
} = require('@config/constants/domain');
const EventTaskRegistry = require('../../../infrastructure/queue/eventTaskRegistry');
const TaskRunner = require('../../../infrastructure/queue/taskRunnerService');
const { BettingRuleEngine } = require('@domain/rule-engine');
const { buildResultState, getCurrentResult } = require('@domain/results/resultState');
const {
  SessionExposureState,
  ExposureDeltaGenerator,
  ExposureLookupEngine,
  buildExposureSnapshot,
} = require('@domain/exposure');
const { ValidationError, NotFoundError } = require('@utils/errors');
const logger = require('@utils/logger');
const { canonicalizePana } = require('@utils/panaCanonicalization');
const { getCurrentISTTime } = require('@utils/timezoneHelper');
const { simulateOutcomes } = require('./OutcomeSimulator');
const { dispatchResultDeclared } = require('./NotificationDispatcher');

const gameSessionRepository = RepositoryFactory.getRepository('GameSession');
const betRepository = RepositoryFactory.getRepository('Bet');
const sessionExposureRepository = RepositoryFactory.getRepository('SessionExposure');
const marketRepository = RepositoryFactory.getRepository('Market');
const resultAuditRecordRepository = RepositoryFactory.getRepository('ResultAuditRecord') || null;
const settlementJobRepository = RepositoryFactory.getRepository('SettlementJob');
const bettingRuleEngine = new BettingRuleEngine();

const OPEN_DECLARATION_PHASES = new Set([
  SESSION_PHASE.OPEN_RUNNING,
  SESSION_PHASE.CLOSE_RUNNING,
  SESSION_PHASE.MARKET_CLOSED,
]);
const CLOSE_DECLARATION_PHASES = new Set([SESSION_PHASE.CLOSE_RUNNING, SESSION_PHASE.MARKET_CLOSED]);

const hasOpenResult = (session) => (
  !!session?.result?.openPana
  && session?.result?.openDigit !== null
  && session?.result?.openDigit !== undefined
);

const hasCloseResult = (session) => (
  !!session?.result?.closePana
  && session?.result?.closeDigit !== null
  && session?.result?.closeDigit !== undefined
);

const normalizePhase = (phase) => {
  if (!phase) {
    return null;
  }

  if (phase === SESSION_PHASE_ALIAS.OPEN) {
    return SESSION_PHASE.OPEN_RUNNING;
  }
  if (phase === SESSION_PHASE_ALIAS.CLOSE) {
    return SESSION_PHASE.CLOSE_RUNNING;
  }

  return phase;
};

const resolveModeForSimulation = (sessionPhase) => {
  if (sessionPhase === SESSION_PHASE.OPEN_RUNNING) {
    return BET_MODE.OPEN;
  }
  if (sessionPhase === SESSION_PHASE.CLOSE_RUNNING || sessionPhase === SESSION_PHASE.MARKET_CLOSED) {
    return BET_MODE.CLOSE;
  }
  throw new ValidationError('Session is already settled');
};

const validatePana = (pana) => {
  bettingRuleEngine.deriveDigitFromPana(canonicalizePana(pana));
};

const rebuildExposureSnapshot = async (sessionId, pendingBetsOverride = null) => {
  const pendingBets = pendingBetsOverride || await betRepository.findPendingBySession(sessionId);
  if (!pendingBets?.length) {
    return;
  }

  const grouped = ExposureDeltaGenerator.generateGroupedDeltas(pendingBets);
  const groupedBets = {
    [BET_MODE.OPEN]: pendingBets.filter((bet) => bet.betMode === BET_MODE.OPEN),
    [BET_MODE.CLOSE]: pendingBets.filter((bet) => bet.betMode === BET_MODE.CLOSE),
  };

  for (const [mode, delta] of Object.entries(grouped)) {
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

    // Avoid double-counting if a mode snapshot was already materialized.
    const existing = await sessionExposureRepository.findBySessionAndMode(sessionId, mode);
    if (existing) {
      continue;
    }

    await sessionExposureRepository.applyDelta({
      sessionId,
      mode,
      delta,
    });
  }
};

const resolveDeclarationPhase = (session, sessionPhase) => {
  const normalizedPhase = normalizePhase(sessionPhase);
  const currentPhase = session.phase;
  const now = getCurrentISTTime();
  const openPhaseEnded = session?.openTime ? now >= new Date(session.openTime) : false;
  const closePhaseEnded = session?.closeTime ? now >= new Date(session.closeTime) : false;

  if ((session.status || SESSION_STATUS.ACTIVE) !== SESSION_STATUS.ACTIVE) {
    throw new ValidationError('Result declaration is not allowed for a non-active session');
  }

  if (currentPhase === SESSION_PHASE.SETTLED) {
    throw new ValidationError('Cannot declare result for a settled session');
  }

  if (!normalizedPhase) {
    if (!session.openResultDeclared) {
      return SESSION_PHASE.OPEN_RUNNING;
    }

    if (CLOSE_DECLARATION_PHASES.has(currentPhase)) {
      return SESSION_PHASE.CLOSE_RUNNING;
    }

    throw new ValidationError('Invalid session phase for declaration');
  }

  if (normalizedPhase === SESSION_PHASE.OPEN_RUNNING) {
    if (!OPEN_DECLARATION_PHASES.has(currentPhase)) {
      throw new ValidationError('Session phase mismatch');
    }
    if (!openPhaseEnded) {
      throw new ValidationError('Open result can only be declared after the open phase has ended');
    }
    return SESSION_PHASE.OPEN_RUNNING;
  }

  if ([SESSION_PHASE.CLOSE_RUNNING, SESSION_PHASE.MARKET_CLOSED].includes(normalizedPhase)) {
    if (!CLOSE_DECLARATION_PHASES.has(currentPhase)) {
      throw new ValidationError('Session phase mismatch');
    }
    if (!hasOpenResult(session)) {
      throw new ValidationError('Open result must be declared before close result');
    }
    if (!closePhaseEnded) {
      throw new ValidationError('Close result can only be declared after the market close time has passed');
    }
    return SESSION_PHASE.CLOSE_RUNNING;
  }

  throw new ValidationError('Invalid session phase');
};

const simulateResults = async (sessionId) => {
  if (!sessionId) {
    throw new ValidationError('Session ID is required');
  }

  const session = await gameSessionRepository.findById(sessionId);
  if (!session) {
    throw new NotFoundError('Session not found');
  }

  const benchmarkEnabled = process.env.RESULT_SIMULATION_BENCHMARK === 'true';
  const benchmarkStart = benchmarkEnabled ? process.hrtime.bigint() : null;

  const targetMode = resolveModeForSimulation(session.phase);
  const context = {
    openPana: session?.result?.openPana || null,
    openDigit: session?.result?.openDigit ?? null,
  };

  const persistedExposure = await sessionExposureRepository.findBySessionAndMode(sessionId, targetMode);
  let analytics;

  if (persistedExposure) {
    const state = SessionExposureState.fromDocument(persistedExposure) || SessionExposureState.empty();
    analytics = ExposureLookupEngine.simulate({
      state: state.toPlainObject(),
      mode: targetMode,
      context,
    });
  } else {
    // When a snapshot is missing, rebuild simulation inputs from pending bets
    // and then materialize the snapshot for the next read.
    const exposureSummary = await betRepository.getPendingExposureSummary(sessionId, targetMode);
    const pendingBets = await betRepository.findPendingBySession(sessionId, targetMode);
    const snapshotMeta = buildExposureSnapshot(pendingBets || []);
    const exposure = bettingRuleEngine.calculateExposureFromSummary({ summary: exposureSummary });
    analytics = simulateOutcomes(exposure);
    analytics.totalBets = snapshotMeta.totalBets;
    analytics.digitStats = snapshotMeta.digitStats;

    try {
      await rebuildExposureSnapshot(sessionId, pendingBets);
    } catch (error) {
      logger.warn({
        message: 'Exposure snapshot rebuild failed after summary-based simulation',
        sessionId,
        error,
      });
    }
  }

  if (benchmarkEnabled && benchmarkStart) {
    const elapsedMs = Number(process.hrtime.bigint() - benchmarkStart) / 1e6;
    logger.info({
      message: 'Result simulation benchmark',
      sessionId,
      betMode: targetMode,
      totalBets: analytics.totalBets,
      elapsedMs,
    });
  }

  return {
    sessionId,
    sessionPhase: session.phase,
    betMode: targetMode,
    ...analytics,
  };
};

const declareResult = async ({
  sessionId,
  pana,
  sessionPhase,
  adminUserId = null,
  reason = 'Initial result declaration',
}) => {
  if (!sessionId) {
    throw new ValidationError('Session ID is required');
  }

  validatePana(pana);

  const session = await gameSessionRepository.findById(sessionId);
  if (!session) {
    throw new NotFoundError('Session not found');
  }

  const declarationPhase = resolveDeclarationPhase(session, sessionPhase);
  const normalizedPana = canonicalizePana(pana);
  const digit = bettingRuleEngine.deriveDigitFromPana(normalizedPana);

  if (declarationPhase === SESSION_PHASE.OPEN_RUNNING && hasOpenResult(session)) {
    const alreadySame =
      String(session.result?.openPana || '') === normalizedPana
      && Number(session.result?.openDigit) === digit;

    if (!alreadySame) {
      throw new ValidationError('Open result already declared for this session');
    }

    return {
      success: true,
      alreadyDeclared: true,
      sessionId: String(session._id),
      phase: session.phase,
      declaredPhase: declarationPhase,
      result: {
        openPana: session.result?.openPana || null,
        openDigit: session.result?.openDigit ?? null,
        closePana: session.result?.closePana || null,
        closeDigit: session.result?.closeDigit ?? null,
      },
      derivedDigit: digit,
      settlementQueued: false,
      betMode: BET_MODE.OPEN,
    };
  }

  if (declarationPhase !== SESSION_PHASE.OPEN_RUNNING && hasCloseResult(session)) {
    const alreadySame =
      String(session.result?.closePana || '') === normalizedPana
      && Number(session.result?.closeDigit) === digit;

    if (!alreadySame) {
      throw new ValidationError('Close result already declared for this session');
    }

    return {
      success: true,
      alreadyDeclared: true,
      sessionId: String(session._id),
      phase: session.phase,
      declaredPhase: declarationPhase,
      result: {
        openPana: session.result?.openPana || null,
        openDigit: session.result?.openDigit ?? null,
        closePana: session.result?.closePana || null,
        closeDigit: session.result?.closeDigit ?? null,
      },
      derivedDigit: digit,
      settlementQueued: false,
      betMode: BET_MODE.CLOSE,
    };
  }

  let updatedSession;
  let settleTaskType;
  let betMode;
  let settlementJob;

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    if (declarationPhase === SESSION_PHASE.OPEN_RUNNING) {
      updatedSession = await gameSessionRepository.declareOpenResult(sessionId, {
        openPana: normalizedPana,
        openDigit: digit,
      }, dbSession);
      settleTaskType = eventTaskTypes.SETTLE_OPEN_RESULT;
      betMode = BET_MODE.OPEN;
    } else {
      updatedSession = await gameSessionRepository.declareCloseResult(sessionId, {
        closePana: normalizedPana,
        closeDigit: digit,
      }, dbSession);
      settleTaskType = eventTaskTypes.SETTLE_CLOSE_RESULT;
      betMode = BET_MODE.CLOSE;
    }

    if (!updatedSession) {
      throw new ValidationError('Failed to update result for the current session phase');
    }

    settlementJob = await settlementJobRepository.create({
      sessionId,
      betMode,
      status: SETTLEMENT_STATUS.PROCESSING,
      resultRevision: updatedSession.resultRevision,
      declaredResultSnapshot: getCurrentResult(updatedSession),
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
    }, dbSession);

    await EventTaskRegistry.scheduleTask({
      type: settleTaskType,
      priority: 3,
      scheduledAt: new Date(),
      session: dbSession,
      payload: {
        sessionId,
        betMode,
        settlementJobId: settlementJob._id,
        resultRevision: updatedSession.resultRevision,
        declaredPana: normalizedPana,
        declaredDigit: digit,
        phase: declarationPhase,
      },
    });

    const resultState = buildResultState({
      ...updatedSession.toObject(),
      settlementStatus: SETTLEMENT_STATUS.PROCESSING,
      lastSettlementJobId: settlementJob._id,
      financialInconsistencyDetectedAt: new Date(),
    });

    updatedSession = await gameSessionRepository.updateResultState(
      sessionId,
      {
        settlementStatus: SETTLEMENT_STATUS.PROCESSING,
        lastSettlementJobId: settlementJob._id,
        isFinanciallyConsistent: resultState.isFinanciallyConsistent,
        financialInconsistencyReason: resultState.financialInconsistencyReason,
        financialInconsistencyDetectedAt: resultState.financialInconsistencyDetectedAt,
        warning: resultState.warning,
      },
      dbSession,
    );

    if (resultAuditRecordRepository?.create) {
      await resultAuditRecordRepository.create(
        {
          sessionId,
          resultRevision: updatedSession.resultRevision,
          actor: adminUserId,
          action: betMode === BET_MODE.OPEN ? 'declare_open' : 'declare_close',
          reason,
          beforeSnapshot: getCurrentResult(session),
          afterSnapshot: getCurrentResult(updatedSession),
          financialStateChanged: true,
          settlementJobId: settlementJob._id,
        },
        dbSession,
      );
    }

    await dbSession.commitTransaction();
  } catch (error) {
    await dbSession.abortTransaction();
    throw error;
  } finally {
    dbSession.endSession();
  }

  // Trigger settlement immediately instead of waiting for the 10-minute cron cycle
  setTimeout(() => {
    TaskRunner.run().catch((err) => {
      logger.error({
        message: 'immediate.settlement_trigger_failed',
        sessionId,
        betMode,
        error: err,
      });
    });
  }, 0);

  const market = await marketRepository.findById(updatedSession.marketId);

  logger.info({
    message: 'result.declared',
    sessionId: String(updatedSession._id),
    marketId: updatedSession.marketId ? String(updatedSession.marketId) : null,
    marketCode: market?.code || null,
    betMode,
    declaredPhase: declarationPhase,
    declaredPana: normalizedPana,
    declaredDigit: digit,
    settlementQueued: true,
    settlementJobId: settlementJob?._id ? String(settlementJob._id) : null,
    resultRevision: updatedSession.resultRevision,
  });

  try {
    await dispatchResultDeclared({
      sessionId,
      session: updatedSession,
      market,
      declarationMode: betMode,
    });
  } catch (error) {
    logger.error({
      message: 'Failed to dispatch result notification',
      sessionId,
      error,
    });
  }

  return {
    success: true,
    sessionId: String(updatedSession._id),
    phase: updatedSession.phase,
    declaredPhase: declarationPhase,
    marketName: market?.name || null,
    ...buildResultState(updatedSession.toObject()),
    derivedDigit: digit,
    settlementQueued: true,
    settlementJobId: settlementJob?._id ? String(settlementJob._id) : null,
    betMode,
  };
};

module.exports = {
  simulateResults,
  declareResult,
  deriveDigitFromPana: (pana) => bettingRuleEngine.deriveDigitFromPana(pana),
};

