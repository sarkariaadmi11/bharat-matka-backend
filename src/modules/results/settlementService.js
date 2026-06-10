const mongoose = require('mongoose');
const { RepositoryFactory } = require('@infra/database');
const { BET_STATUS, BET_MODE } = require('@config/constants/domain');
const { BettingRuleEngine } = require('@domain/rule-engine');

const walletRepository = RepositoryFactory.getRepository('Wallet');
const transactionRepository = RepositoryFactory.getRepository('Transaction');
const betRepository = RepositoryFactory.getRepository('Bet');
const gameSessionRepository = RepositoryFactory.getRepository('GameSession');
const marketRepository = RepositoryFactory.getRepository('Market');
const bettingRuleEngine = new BettingRuleEngine();

const mapDebitTransactionsByBetId = (transactions = []) => {
  const mapping = new Map();

  for (const transaction of transactions) {
    const transactionId = transaction?._id || null;
    for (const betId of transaction?.betIds || []) {
      const key = String(betId);
      if (!mapping.has(key) && transactionId) {
        mapping.set(key, transactionId);
      }
    }
  }

  return mapping;
};

/**
 * Process Batch Settlement
 * Takes pre-calculated lists of winning and losing bets and applies updates atomically.
 */
const processBatchSettlement = async (winningBets, losingBets) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const winningBetIds = winningBets.map((bet) => bet?._id).filter(Boolean);
    const betDebitTransactions = winningBetIds.length
      ? await transactionRepository.findBetDebitTransactionsByBetIds(winningBetIds, session)
      : [];
    const debitTransactionMap = mapDebitTransactionsByBetId(betDebitTransactions);

    const winningSessionIds = [...new Set(
      winningBets
        .map((bet) => bet?.sessionId && String(bet.sessionId))
        .filter(Boolean),
    )];

    const winningSessions = winningSessionIds.length
      ? await gameSessionRepository.findLeanByIds(winningSessionIds, '_id marketId result')
      : [];
    const winningMarkets = winningSessions.length
      ? await marketRepository.findLeanByIds(
        [...new Set(winningSessions.map((item) => String(item.marketId)).filter(Boolean))],
        '_id code name',
      )
      : [];

    const sessionMap = Object.fromEntries(
      winningSessions.map((item) => [String(item._id), item]),
    );

    const resolveResultPanaForBet = (bet, sessionDoc) => {
      if (!sessionDoc?.result) {
        return null;
      }

      if (bet.betMode === BET_MODE.OPEN) {
        return sessionDoc.result.openPana || null;
      }

      return sessionDoc.result.closePana || null;
    };
    const marketMap = Object.fromEntries(
      winningMarkets.map((item) => [String(item._id), item]),
    );

    for (const bet of winningBets) {
      const settledSession = sessionMap[String(bet.sessionId)] || null;
      const resultPana = resolveResultPanaForBet(bet, settledSession);
      const payout = bettingRuleEngine.calculatePayout({ bet, resultPana });
      const market = settledSession ? marketMap[String(settledSession.marketId)] || null : null;

      const wallet = await walletRepository.settleWin(
        bet.userId,
        bet.amount,
        payout,
        session,
      );

      await transactionRepository.recordWinCredit(
        {
          userId: bet.userId,
          amount: payout,
          balanceAfter: wallet.balance,
          winAmount: payout,
          relatedTransactionId: debitTransactionMap.get(String(bet._id)) || null,
          betIds: [bet._id],
          sessionId: bet.sessionId,
          marketCode: market?.code || null,
          gameTypeCode: bet.gameTypeCodeSnapshot || bet.gameTypeCode || null,
          selections: bet.selection ? [bet.selection] : [],
          betMode: bet.betMode || null,
          referenceId: bet._id,
        },
        session,
      );

      await betRepository.update(
        bet._id,
        { status: BET_STATUS.WON, payout },
        session,
      );
    }

    for (const bet of losingBets) {
      await walletRepository.settleLoss(
        bet.userId,
        bet.amount,
        session,
      );

      await betRepository.update(
        bet._id,
        { status: BET_STATUS.LOST, payout: 0 },
        session,
      );
    }

    await session.commitTransaction();
    return { success: true };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = {
  processBatchSettlement,
};

