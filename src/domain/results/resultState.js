const { SETTLEMENT_STATUS } = require('@config/constants/domain');

const EMPTY_RESULT = Object.freeze({
  openPana: null,
  closePana: null,
  openDigit: null,
  closeDigit: null,
  openDeclaredAt: null,
  closeDeclaredAt: null,
});

const normalizeResult = (result = {}) => ({
  openPana: result?.openPana || null,
  closePana: result?.closePana || null,
  openDigit: result?.openDigit ?? null,
  closeDigit: result?.closeDigit ?? null,
  openDeclaredAt: result?.openDeclaredAt || null,
  closeDeclaredAt: result?.closeDeclaredAt || null,
});

const getCurrentResult = (session = {}) => normalizeResult(session.currentResult || session.result || EMPTY_RESULT);
const getSettledResult = (session = {}) => normalizeResult(session.settledResult || EMPTY_RESULT);

const areResultsEquivalent = (left = EMPTY_RESULT, right = EMPTY_RESULT) => (
  left.openPana === right.openPana
  && left.closePana === right.closePana
  && left.openDigit === right.openDigit
  && left.closeDigit === right.closeDigit
);

const determineFinancialConsistency = (session = {}) => {
  if (session?.isFinanciallyConsistent === false) {
    return false;
  }

  const currentResult = getCurrentResult(session);
  const settledResult = getSettledResult(session);
  const settlementStatus = session?.settlementStatus || null;
  const currentRevision = Number(session?.resultRevision || 0);
  const settledRevision = Number(session?.settledResultRevision || 0);
  const hasCurrentResult = Object.values(currentResult).some((value) => value !== null);
  const hasSettledResult = Object.values(settledResult).some((value) => value !== null);

  if (!hasCurrentResult && !hasSettledResult) {
    return true;
  }

  if (settlementStatus === SETTLEMENT_STATUS.PROCESSING || settlementStatus === SETTLEMENT_STATUS.PENDING) {
    return false;
  }

  if (settlementStatus === SETTLEMENT_STATUS.FAILED) {
    return false;
  }

  return currentRevision === settledRevision && areResultsEquivalent(currentResult, settledResult);
};

const buildResultWarning = (session = {}) => {
  if (session?.warning?.code && session?.warning?.message) {
    return session.warning;
  }

  const settlementStatus = session?.settlementStatus || null;
  const isFinanciallyConsistent = determineFinancialConsistency(session);

  if (isFinanciallyConsistent) {
    return null;
  }

  if (settlementStatus === SETTLEMENT_STATUS.PROCESSING || settlementStatus === SETTLEMENT_STATUS.PENDING) {
    return {
      code: 'RESULT_SETTLEMENT_IN_PROGRESS',
      message: 'Current displayed result is being settled. Wallet balances may not yet reflect this revision.',
      severity: 'medium',
      actionRequired: false,
      recommendedAction: 'Wait for settlementStatus to become completed before assuming wallet parity.',
      referenceSessionId: session?._id ? String(session._id) : null,
    };
  }

  if (settlementStatus === SETTLEMENT_STATUS.FAILED) {
    return {
      code: 'RESULT_SETTLEMENT_FAILED',
      message: 'Current displayed result differs from financial settlement because the latest settlement attempt failed.',
      severity: 'high',
      actionRequired: true,
      recommendedAction: 'Review the failed settlement job and reconcile affected balances before further result changes.',
      referenceSessionId: session?._id ? String(session._id) : null,
    };
  }

  return {
    code: 'RESULT_FINANCIAL_DIVERGENCE',
    message: 'Current displayed result differs from the financially settled result. No wallet balances were changed automatically.',
    severity: 'high',
    actionRequired: true,
    recommendedAction: 'Use admin reconciliation tools before assuming ledger state matches the displayed result.',
    referenceSessionId: session?._id ? String(session._id) : null,
  };
};

const buildResultState = (session = {}) => {
  const currentResult = getCurrentResult(session);
  const settledResult = getSettledResult(session);
  const isFinanciallyConsistent = determineFinancialConsistency(session);
  const warning = buildResultWarning(session);

  return {
    currentResult,
    settledResult,
    result: currentResult,
    resultRevision: Number(session?.resultRevision || 0),
    settledResultRevision: Number(session?.settledResultRevision || 0),
    settlementStatus: session?.settlementStatus || null,
    lastSettlementJobId: session?.lastSettlementJobId ? String(session.lastSettlementJobId) : null,
    isFinanciallyConsistent,
    financialInconsistencyReason: isFinanciallyConsistent
      ? null
      : (session?.financialInconsistencyReason || warning?.code || 'UNKNOWN'),
    financialInconsistencyDetectedAt: isFinanciallyConsistent
      ? null
      : (session?.financialInconsistencyDetectedAt || new Date()),
    warning,
  };
};

module.exports = {
  EMPTY_RESULT,
  normalizeResult,
  getCurrentResult,
  getSettledResult,
  determineFinancialConsistency,
  buildResultWarning,
  buildResultState,
};
