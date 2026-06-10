const {
  SESSION_PHASE,
  SESSION_STATUS,
  SESSION_PHASE_ALIAS,
  BET_MODE,
} = require('@config/constants/domain');
const { ValidationError } = require('@utils/errors');
const { RepositoryFactory } = require('@infra/database');
const mongoose = require('mongoose');
const gameSessionService = require('@modules/sessions/sessions.service');
const resultApplicationService = require('@modules/results/engine/ResultApplicationService');
const { buildResultState, getCurrentResult } = require('@domain/results/resultState');
const logger = require('@utils/logger');
const { getCurrentISTTime } = require('@utils/timezoneHelper');
const { expandWinnerPreviewItems } = require('@modules/bets/betProjection.service');
const { evaluateCombinedResultBetsForPreview } = require('@domain/preview/CombinedGamePreviewService');

const gameSessionRepository = RepositoryFactory.getRepository('GameSession');
const resultAuditRecordRepository = RepositoryFactory.getRepository('ResultAuditRecord');

const normalizePreviewPhase = (phase) => {
  if (!phase) {
    return null;
  }

  const normalized = String(phase).trim().toLowerCase();

  if (normalized === 'open_running' || normalized === SESSION_PHASE_ALIAS.OPEN) {
    return SESSION_PHASE.OPEN_RUNNING;
  }

  if (normalized === 'close_running' || normalized === SESSION_PHASE_ALIAS.CLOSE) {
    return SESSION_PHASE.CLOSE_RUNNING;
  }

  return normalized;
};

const findSessionByIdOrThrow = async (sessionId) => {
  try {
    return await gameSessionRepository.findById(sessionId);
  } catch (error) {
    if (error?.message === 'GameSession not found') {
      throw new ValidationError('Session not found');
    }
    throw error;
  }
};

const findMarketByIdOrThrow = async (marketRepository, marketId) => {
  try {
    return await marketRepository.findById(marketId);
  } catch (error) {
    if (error?.message === 'Market not found') {
      throw new ValidationError('Market not found');
    }
    throw error;
  }
};

const ensureOpenDeclarationAllowed = async (sessionId) => {
  const session = await gameSessionService.getSessionById(sessionId);

  if ((session.status || SESSION_STATUS.ACTIVE) !== SESSION_STATUS.ACTIVE) {
    throw new ValidationError('Result declaration is not allowed for a non-active session');
  }

  if (![SESSION_PHASE.OPEN_RUNNING, SESSION_PHASE.CLOSE_RUNNING, SESSION_PHASE.MARKET_CLOSED].includes(session.phase)) {
    throw new ValidationError('Open result can only be declared in open_running, close_running, or market_closed phase');
  }

  if (session.openTime && getCurrentISTTime() < new Date(session.openTime)) {
    throw new ValidationError('Open result can only be declared after the open phase has ended');
  }

  return session;
};

const ensureCloseDeclarationAllowed = async (sessionId) => {
  const session = await gameSessionService.getSessionById(sessionId);

  if ((session.status || SESSION_STATUS.ACTIVE) !== SESSION_STATUS.ACTIVE) {
    throw new ValidationError('Result declaration is not allowed for a non-active session');
  }

  if (![SESSION_PHASE.CLOSE_RUNNING, SESSION_PHASE.MARKET_CLOSED].includes(session.phase)) {
    throw new ValidationError('Close result can only be declared in close_running or market_closed phase');
  }

  if (!session.openResultDeclared || !session.result?.openPana) {
    throw new ValidationError('Open result must be declared before close result');
  }

  if (session.closeTime && getCurrentISTTime() < new Date(session.closeTime)) {
    throw new ValidationError('Close result can only be declared after the market close time has passed');
  }

  return session;
};

const declareOpenResult = async ({ sessionId, openPana, adminUserId, reason }) => {
  await ensureOpenDeclarationAllowed(sessionId);

  const result = await resultApplicationService.declareResult({
    sessionId,
    pana: String(openPana),
    sessionPhase: SESSION_PHASE.OPEN_RUNNING,
    adminUserId,
    reason,
  });

  return {
    sessionId: result.sessionId,
    declaredPhase: result.declaredPhase,
    result: result.result,
    currentResult: result.currentResult,
    settledResult: result.settledResult,
    resultRevision: result.resultRevision,
    settledResultRevision: result.settledResultRevision,
    settlementStatus: result.settlementStatus,
    settlementJobId: result.settlementJobId || result.lastSettlementJobId || null,
    isFinanciallyConsistent: result.isFinanciallyConsistent,
    warning: result.warning,
    derivedDigit: result.derivedDigit,
    settlementQueued: result.settlementQueued,
    betMode: BET_MODE.OPEN,
  };
};

const declareCloseResult = async ({ sessionId, closePana, adminUserId, reason }) => {
  await ensureCloseDeclarationAllowed(sessionId);

  const result = await resultApplicationService.declareResult({
    sessionId,
    pana: String(closePana),
    sessionPhase: SESSION_PHASE.CLOSE_RUNNING,
    adminUserId,
    reason,
  });

  return {
    sessionId: result.sessionId,
    declaredPhase: result.declaredPhase,
    result: result.result,
    currentResult: result.currentResult,
    settledResult: result.settledResult,
    resultRevision: result.resultRevision,
    settledResultRevision: result.settledResultRevision,
    settlementStatus: result.settlementStatus,
    settlementJobId: result.settlementJobId || result.lastSettlementJobId || null,
    isFinanciallyConsistent: result.isFinanciallyConsistent,
    warning: result.warning,
    derivedDigit: result.derivedDigit,
    settlementQueued: result.settlementQueued,
    betMode: BET_MODE.CLOSE,
  };
};

const ensureExpectedRevision = (session, expectedResultRevision) => {
  if (expectedResultRevision === undefined) {
    return;
  }

  if (Number(session.resultRevision || 0) !== Number(expectedResultRevision)) {
    throw new ValidationError(`Result revision mismatch. Expected ${expectedResultRevision}, got ${session.resultRevision}`);
  }
};

const buildResetResponse = (session, betMode, resetReason) => ({
  sessionId: String(session._id),
  declaredPhase: betMode === BET_MODE.OPEN ? SESSION_PHASE.OPEN_RUNNING : SESSION_PHASE.CLOSE_RUNNING,
  betMode,
  resetReason,
  ...buildResultState(session.toObject ? session.toObject() : session),
});

// Reset must clear the displayed result without forcing an immediate replacement.
// This keeps correction and redeclaration as separate admin actions.
const buildClearedResultSnapshot = (session, betMode) => {
  const currentResult = getCurrentResult(session);
  const nextResult = { ...currentResult };

  if (betMode === BET_MODE.OPEN) {
    nextResult.openPana = null;
    nextResult.openDigit = null;
    nextResult.openDeclaredAt = null;
    return {
      nextResult,
      openResultDeclared: false,
    };
  }

  nextResult.closePana = null;
  nextResult.closeDigit = null;
  nextResult.closeDeclaredAt = null;
  return {
    nextResult,
    openResultDeclared: session.openResultDeclared,
  };
};

const resetSessionResult = async ({
  sessionId,
  expectedResultRevision,
  reason,
  note,
  adminUserId,
  betMode,
}) => {
  const session = await gameSessionService.getSessionById(sessionId);
  ensureExpectedRevision(session, expectedResultRevision);

  const currentResult = getCurrentResult(session);

  if (betMode === BET_MODE.OPEN && !currentResult.openPana) {
    throw new ValidationError('Open result must be declared before it can be reset');
  }

  if (betMode === BET_MODE.CLOSE && !currentResult.closePana) {
    throw new ValidationError('Close result must be declared before it can be reset');
  }

  const nextSettlementStatus = ['processing', 'pending'].includes(session.settlementStatus)
    ? 'failed'
    : session.settlementStatus;
  const { nextResult, openResultDeclared } = buildClearedResultSnapshot(session, betMode);
  const nextRevision = Number(session.resultRevision || 0) + 1;
  const nextSessionState = {
    ...(session.toObject ? session.toObject() : session),
    openResultDeclared,
    result: nextResult,
    currentResult: nextResult,
    resultRevision: nextRevision,
    settlementStatus: nextSettlementStatus,
    financialInconsistencyDetectedAt: new Date(),
  };
  const resultState = buildResultState(nextSessionState);

  // Persist session state and the audit record in one transaction so the
  // revision history never advances without a matching audit entry.
  const updates = {
    openResultDeclared,
    result: resultState.result,
    currentResult: resultState.currentResult,
    resultRevision: nextRevision,
    settlementStatus: nextSettlementStatus,
    isFinanciallyConsistent: resultState.isFinanciallyConsistent,
    financialInconsistencyReason: resultState.financialInconsistencyReason,
    financialInconsistencyDetectedAt: resultState.financialInconsistencyDetectedAt,
    warning: resultState.warning,
  };

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  let updatedSession;

  try {
    updatedSession = await gameSessionRepository.updateResultState(sessionId, updates, dbSession);

    await resultAuditRecordRepository.create({
      sessionId,
      resultRevision: updatedSession.resultRevision,
      actor: adminUserId,
      action: betMode === BET_MODE.OPEN ? 'reset_open' : 'reset_close',
      reason,
      beforeSnapshot: getCurrentResult(session),
      afterSnapshot: getCurrentResult(updatedSession),
      financialStateChanged: !resultState.isFinanciallyConsistent,
      note: note || null,
    }, dbSession);

    await dbSession.commitTransaction();
  } catch (error) {
    await dbSession.abortTransaction();
    throw error;
  } finally {
    dbSession.endSession();
  }

  logger.info({
    message: 'result.reset',
    sessionId: String(updatedSession._id),
    adminUserId: adminUserId ? String(adminUserId) : null,
    betMode,
    reason,
    note: note || null,
    resultRevision: updatedSession.resultRevision,
    settlementStatus: updatedSession.settlementStatus,
  });

  return buildResetResponse(updatedSession, betMode, reason);
};

const resetOpenResult = async (payload) => resetSessionResult({
  ...payload,
  betMode: BET_MODE.OPEN,
});

const resetCloseResult = async (payload) => resetSessionResult({
  ...payload,
  betMode: BET_MODE.CLOSE,
});

const previewWinnersForResult = async ({
  sessionId,
  phase,
  pana,
  page = 1,
  limit = 50,
}) => {
  const { BettingRuleEngine, ResultEvaluator } = require('@domain/rule-engine');
  const betRepository = RepositoryFactory.getRepository('Bet');
  const userRepository = RepositoryFactory.getRepository('User');
  const marketRepository = RepositoryFactory.getRepository('Market');
  const gameTypeRepository = RepositoryFactory.getRepository('GameType');

  const session = await findSessionByIdOrThrow(sessionId);
  const market = await findMarketByIdOrThrow(marketRepository, session.marketId);
  const normalizedPhase = normalizePreviewPhase(phase);

  if (![SESSION_PHASE.OPEN_RUNNING, SESSION_PHASE.CLOSE_RUNNING].includes(normalizedPhase)) {
    throw new ValidationError('Phase must be either OPEN_RUNNING or CLOSE_RUNNING');
  }

  const isClosePhasePreview = normalizedPhase === SESSION_PHASE.CLOSE_RUNNING;
  const betMode = isClosePhasePreview ? BET_MODE.CLOSE : BET_MODE.OPEN;

  // Build temporary result for the current phase selection (used by non-combined bets)
  const tempResult = {
    pana: String(pana),
    digit: (String(pana).split('').reduce((sum, d) => sum + parseInt(d, 10), 0) % 10).toString(),
  };

  // Fetch standard phase bets and evaluate them (open bets for open preview,
  // close bets for close preview — single digit, single pana, motor, etc.)
  const phaseBets = await betRepository.findPendingBySession(sessionId, betMode);
  const { winners: phaseWinners } = ResultEvaluator.splitWinnersAndLosers({
    bets: phaseBets,
    result: tempResult,
    session,
  });

  // For close phase: also evaluate Jodi and Sangam bets.
  //
  // WHY THEY ARE MISSING FROM STANDARD CLOSE PREVIEW:
  //   Jodi, Half Sangam A/B, and Full Sangam are always placed during the open
  //   phase (betMode='open') and stored in the database that way. The standard
  //   close query (betMode='close') therefore never returns them. Additionally,
  //   ResultEvaluator reads session.result.closeDigit / closePana to resolve
  //   combined values — both are null before declaration — so even fetching them
  //   directly would always evaluate to false.
  //
  // FIX: fetch these bets separately, then evaluate them against a temporary merged
  //   session that has the preview close pana injected. No DB writes occur.
  let combinedBets = [];
  let combinedWinners = [];
  if (isClosePhasePreview) {
    combinedBets = await betRepository.findPendingCombinedResultBets(sessionId);
    ({ winners: combinedWinners } = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana: String(pana),
      combinedBets,
    }));
  }

  const allWinners = [...phaseWinners, ...combinedWinners];
  const totalBetsEvaluated = phaseBets.length + combinedBets.length;

  // Fetch user details and game type metadata for winner rows
  const bettingRuleEngine = new BettingRuleEngine();
  const sessionLabel = isClosePhasePreview ? 'Close' : 'Open';
  const uniqueUserIds = [...new Set(allWinners.map((bet) => bet.userId))];
  const uniqueGameTypeIds = [...new Set(allWinners.map((bet) => String(bet.gameTypeId)).filter(Boolean))];

  const [users, gameTypes] = await Promise.all([
    uniqueUserIds.length > 0 ? userRepository.find({ _id: { $in: uniqueUserIds } }) : [],
    uniqueGameTypeIds.length > 0 ? gameTypeRepository.findLeanByIds(uniqueGameTypeIds) : [],
  ]);

  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));
  const gameTypeMap = Object.fromEntries(gameTypes.map((gt) => [String(gt._id), gt]));

  const expandedWinners = allWinners.flatMap((bet) => {
    const user = userMap[String(bet.userId)] || {};
    const gameType = gameTypeMap[String(bet.gameTypeId)] || null;
    const betPayoutPaise = bettingRuleEngine.calculatePayout({ bet, resultPana: String(pana) });

    return expandWinnerPreviewItems({
      bet,
      market,
      gameType,
      resultPana: String(pana),
      betPayoutPaise,
      user,
      sessionLabel,
    });
  });

  const totalPages = Math.ceil(expandedWinners.length / limit);
  const skip = (page - 1) * limit;
  const paginatedWinners = expandedWinners.slice(skip, skip + limit).map((item) => ({
    ...item,
    betDigit: item.selection,
  }));

  const totalPayoutInPaise = allWinners.reduce(
    (sum, bet) => sum + bettingRuleEngine.calculatePayout({ bet, resultPana: String(pana) }),
    0,
  );

  return {
    data: paginatedWinners,
    summary: {
      totalWinningBets: allWinners.length,
      totalPreviewRows: expandedWinners.length,
      totalWinners: expandedWinners.length,
      totalBets: totalBetsEvaluated,
      totalLosingBets: totalBetsEvaluated - allWinners.length,
      totalWinningPayout: totalPayoutInPaise / 100,
    },
    pagination: {
      page,
      limit,
      total: expandedWinners.length,
      pages: totalPages,
    },
    previewInfo: {
      sessionId,
      phase: normalizedPhase,
      resultPana: String(pana),
      resultDigit: tempResult.digit,
      market: market.code || market.name || 'N/A',
      marketId: market._id,
      previewedAt: new Date(),
    },
  };
};

module.exports = {
  declareOpenResult,
  declareCloseResult,
  resetOpenResult,
  resetCloseResult,
  previewWinnersForResult,
};
