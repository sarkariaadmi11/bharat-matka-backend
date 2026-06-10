const resultApplicationService = require('./engine/ResultApplicationService');

const simulateResults = async (sessionId) => {
  const analytics = await resultApplicationService.simulateResults(sessionId);
  return analytics.topOutcomes;
};

module.exports = {
  simulateResults,
};

