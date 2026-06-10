const { buildResultState } = require('@domain/results/resultState');

const mapUserSessionDetails = (session, market = null) => {
  const resultState = buildResultState(session.toObject ? session.toObject() : session);

  return {
    sessionId: String(session._id),
    marketId: String(session.marketId),
    marketName: market?.name || session.marketName || null,
    phase: session.phase,
    status: session.status,
    openTime: session.openTime,
    closeTime: session.closeTime,
    result: resultState.result,
    currentResult: resultState.currentResult,
  };
};

const mapAdminSessionDetails = (session, market = null) => {
  const resultState = buildResultState(session.toObject ? session.toObject() : session);

  return {
    sessionId: String(session._id),
    marketId: String(session.marketId),
    marketName: market?.name || session.marketName || null,
    phase: session.phase,
    status: session.status,
    openTime: session.openTime,
    closeTime: session.closeTime,
    cancellationReason: session.cancellationReason || null,
    cancelledAt: session.cancelledAt || null,
    cancelledBy: session.cancelledBy || null,

    result: resultState.result,
    currentResult: resultState.currentResult,
    settledResult: resultState.settledResult,
    resultRevision: resultState.resultRevision,
    settledResultRevision: resultState.settledResultRevision,
    settlementStatus: resultState.settlementStatus,
    isFinanciallyConsistent: resultState.isFinanciallyConsistent,
    warning: resultState.warning,
    lastSettlementJobId: resultState.lastSettlementJobId,

    resultDeclarationAvailableTill: session.resultDeclarationAvailableTill || null,
  };
};

module.exports = {
  mapUserSessionDetails,
  mapAdminSessionDetails,
};
