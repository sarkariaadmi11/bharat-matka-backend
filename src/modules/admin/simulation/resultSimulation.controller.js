const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils/response');
const simulationService = require('./resultSimulation.service');

const simulateResults = asyncHandler(async (req, res) => {
  const data = await simulationService.simulateSessionOutcomes({
    sessionId: req.params.sessionId,
  });

  sendSuccess(res, data, 'Result simulation completed');
});

module.exports = {
  simulateResults,
};
