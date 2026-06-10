const { RepositoryFactory } = require('@infra/database');
const { ValidationError } = require('@utils/errors');
const logger = require('@utils/logger');
const { BET_MODE, SESSION_STATUS, SETTLEMENT_STATUS } = require('@config/constants/domain');
const { BettingRuleEngine, ResultEvaluator } = require('@domain/rule-engine');
const { buildResultState, getCurrentResult, getSettledResult } = require('@domain/results/resultState');
const settlementService = require('@modules/results/settlementService');

const gameSessionRepository = RepositoryFactory.getRepository('GameSession');
const betRepository = RepositoryFactory.getRepository('Bet');
const settlementJobRepository = RepositoryFactory.getRepository('SettlementJob');
const bettingRuleEngine = new BettingRuleEngine();

const toPlainSession = (session) => (session?.toObject ? session.toObject() : session);

const ensureSettlementSessionIsActive = async ({ sessionId, settlementJobId = null, resultRevision = null }) => {
  const session = await gameSessionRepository.findById(sessionId);
  const sessionStatus = session.status || SESSION_STATUS.ACTIVE;

  if (sessionStatus !== SESSION_STATUS.ACTIVE) {
    const reason = 'SESSION_CANCELLED';

    if (settlementJobId) {
      await settlementJobRepository.markFailed(settlementJobId, reason);
    }

    logger.warn({
      message: 'settlement.aborted.session_not_active',
      sessionId,
      settlementJobId: settlementJobId || null,
      resultRevision: resultRevision || null,
      status: sessionStatus,
    });

    throw new ValidationError('Settlement aborted because the session is no longer active');
  }

  return session;
};

const shouldSettleBetInPass = (bet, settlementMode) => {
  if (!bet) {
    return false;
  }

  const requiresFinalResult = ResultEvaluator.requiresFinalResult(bet);

  if (settlementMode === BET_MODE.OPEN) {
    return bet.betMode === BET_MODE.OPEN && !requiresFinalResult;
  }

  if (settlementMode === BET_MODE.CLOSE) {
    if (bet.betMode === BET_MODE.CLOSE) {
      return true;
    }

    return bet.betMode === BET_MODE.OPEN && requiresFinalResult;
  }

  return false;
};

const getResultForMode = (session, betMode) => {
  const currentResult = getCurrentResult(session);

  if (betMode === BET_MODE.OPEN) {
    return {
      pana: currentResult.openPana,
      digit: currentResult.openDigit,
    };
  }

  if (betMode === BET_MODE.CLOSE) {
    return {
      pana: currentResult.closePana,
      digit: currentResult.closeDigit,
    };
  }

  throw new ValidationError('Invalid settlement betMode');
};

const classifyBets = (bets, result, session, betMode) => {
  const winners = [];
  const losers = [];
  const deferred = [];

  for (const bet of bets) {
    if (!shouldSettleBetInPass(bet, betMode)) {
      deferred.push(bet);
      continue;
    }

    const isWin = bettingRuleEngine.evaluateWinning({ bet, result, session });
    if (isWin) {
      winners.push(bet);
    } else {
      losers.push(bet);
    }
  }

  return { winners, losers, deferred };
};

const mergeSettledSnapshot = (session, betMode) => {
  const currentResult = getCurrentResult(session);
  const settledResult = getSettledResult(session);

  if (betMode === BET_MODE.OPEN) {
    return {
      ...settledResult,
      openPana: currentResult.openPana,
      openDigit: currentResult.openDigit,
      openDeclaredAt: currentResult.openDeclaredAt,
    };
  }

  return {
    ...settledResult,
    closePana: currentResult.closePana,
    closeDigit: currentResult.closeDigit,
    closeDeclaredAt: currentResult.closeDeclaredAt,
  };
};

const settleResult = async ({ sessionId, betMode, settlementJobId, resultRevision }) => {
  if (!sessionId) {
    throw new ValidationError('sessionId is required');
  }
  if (![BET_MODE.OPEN, BET_MODE.CLOSE].includes(betMode)) {
    throw new ValidationError('betMode must be open or close');
  }

  const session = await ensureSettlementSessionIsActive({ sessionId, settlementJobId, resultRevision });

  if (resultRevision && Number(session.resultRevision || 0) > Number(resultRevision)) {
    const reason = `Settlement job is stale for revision ${resultRevision}; current revision is ${session.resultRevision}`;

    if (settlementJobId) {
      await settlementJobRepository.markFailed(settlementJobId, reason);
    }

    logger.warn({
      message: 'settlement.stale_revision',
      sessionId,
      betMode,
      settlementJobId: settlementJobId || null,
      resultRevision,
      currentRevision: session.resultRevision,
    });

    return {
      sessionId,
      betMode,
      skipped: true,
      reason,
    };
  }

  const result = getResultForMode(session, betMode);
  if (!result.pana || result.digit === null || result.digit === undefined) {
    throw new ValidationError(`${betMode} result not declared for this session`);
  }

  const bets = betMode === BET_MODE.CLOSE
    ? await betRepository.findPendingBySession(sessionId)
    : await betRepository.findPendingBySession(sessionId, betMode);

  if (settlementJobId) {
    await settlementJobRepository.markProcessing(settlementJobId);
  }

  logger.info({
    message: 'settlement.started',
    sessionId,
    betMode,
    settlementJobId: settlementJobId || null,
    resultRevision: resultRevision || null,
    totalPendingBets: bets?.length || 0,
  });

  try {
    if (!bets || bets.length === 0) {
      let updatedSession = await gameSessionRepository.updateResultState(
        sessionId,
        {
          settledResult: mergeSettledSnapshot(session, betMode),
          settledResultRevision: resultRevision || session.resultRevision,
          settlementStatus: SETTLEMENT_STATUS.COMPLETED,
        },
      );

      if (betMode === BET_MODE.CLOSE) {
        updatedSession = await gameSessionRepository.markSettled(sessionId);
      }

      const resultState = buildResultState(toPlainSession(updatedSession));
      await gameSessionRepository.updateResultState(sessionId, {
        isFinanciallyConsistent: resultState.isFinanciallyConsistent,
        financialInconsistencyReason: resultState.financialInconsistencyReason,
        financialInconsistencyDetectedAt: resultState.financialInconsistencyDetectedAt,
        warning: resultState.warning,
      });

      if (settlementJobId) {
        await settlementJobRepository.markCompleted(settlementJobId);
      }

      logger.info({
        message: 'settlement.completed',
        sessionId,
        betMode,
        totalWinningBets: 0,
        totalLosingBets: 0,
        deferredBets: 0,
        totalPayout: 0,
      });
      return {
        sessionId,
        betMode,
        totalWinningBets: 0,
        totalLosingBets: 0,
        totalPayout: 0,
      };
    }

    await ensureSettlementSessionIsActive({ sessionId, settlementJobId, resultRevision });

    const { winners, losers, deferred } = classifyBets(bets, result, session, betMode);
    logger.info({
      message: 'settlement.classification',
      sessionId,
      betMode,
      winnerCount: winners.length,
      loserCount: losers.length,
      deferredCount: deferred.length,
    });

    const totalPayout = winners.reduce(
      (sum, bet) => sum + bettingRuleEngine.calculatePayout({ bet, resultPana: result?.pana }),
      0,
    );

    await settlementService.processBatchSettlement(winners, losers);

    let updatedSession = await gameSessionRepository.updateResultState(
      sessionId,
      {
        settledResult: mergeSettledSnapshot(session, betMode),
        settledResultRevision: resultRevision || session.resultRevision,
        settlementStatus: SETTLEMENT_STATUS.COMPLETED,
        settledAt: new Date(),
      },
    );

    if (betMode === BET_MODE.CLOSE) {
      const remainingPending = await betRepository.findPendingBySession(sessionId);
      if (!remainingPending.length) {
        updatedSession = await gameSessionRepository.markSettled(sessionId);
      } else {
        logger.warn({
          message: 'settlement.pending_remaining',
          sessionId,
          betMode,
          remainingPendingBets: remainingPending.length,
        });
      }
    }

    const resultState = buildResultState(toPlainSession(updatedSession));
    await gameSessionRepository.updateResultState(sessionId, {
      isFinanciallyConsistent: resultState.isFinanciallyConsistent,
      financialInconsistencyReason: resultState.financialInconsistencyReason,
      financialInconsistencyDetectedAt: resultState.financialInconsistencyDetectedAt,
      warning: resultState.warning,
    });

    if (settlementJobId) {
      await settlementJobRepository.markCompleted(settlementJobId);
    }

    logger.info({
      message: 'settlement.completed',
      sessionId,
      betMode,
      totalWinningBets: winners.length,
      totalLosingBets: losers.length,
      deferredBets: deferred.length,
      totalPayout,
    });

    return {
      sessionId,
      betMode,
      totalWinningBets: winners.length,
      totalLosingBets: losers.length,
      deferredBets: deferred.length,
      totalPayout,
    };
  } catch (error) {
    await gameSessionRepository.updateResultState(
      sessionId,
      {
        settlementStatus: SETTLEMENT_STATUS.FAILED,
        isFinanciallyConsistent: false,
        financialInconsistencyReason: 'RESULT_SETTLEMENT_FAILED',
        financialInconsistencyDetectedAt: new Date(),
        warning: buildResultState({
          ...toPlainSession(session),
          settlementStatus: SETTLEMENT_STATUS.FAILED,
          financialInconsistencyDetectedAt: new Date(),
        }).warning,
      },
    );

    if (settlementJobId) {
      await settlementJobRepository.markFailed(settlementJobId, error?.message);
    }

    throw error;
  }
};

module.exports = {
  settleResult,
  shouldSettleBetInPass,
  classifyBets,
};

