const resultApplicationService = require('@modules/results/engine/ResultApplicationService');

const simulateSessionOutcomes = async ({ sessionId }) => {
  const analytics = await resultApplicationService.simulateResults(sessionId);

  const simulations = (analytics.topOutcomes || [])
    .slice(0, 10)
    .map((item) => ({
      pana: item.outcomePana,
      digit: item.outcomeDigit,
      payout: item.totalPayout,
      profit: item.netProfit,
    }))
    .sort((a, b) => b.profit - a.profit);

  return {
    simulations,
  };
};

module.exports = {
  simulateSessionOutcomes,
};
