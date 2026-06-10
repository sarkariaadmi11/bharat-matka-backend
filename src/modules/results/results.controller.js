const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils/response');
const gameSessionService = require('../sessions/sessions.service');
const logger = require('@utils/logger');

const getGameResultsByDate = asyncHandler(async (req, res) => {
  const { date, marketId } = req.query;
  logger.info({
    message: 'Fetching game results',
    date,
    marketId: marketId || null,
    userId: req.user?.id || null,
  });

  const results = await gameSessionService.getGameResultsByDate({ date, marketId });

  logger.info({
    message: 'Game results fetched',
    date,
    marketId: marketId || null,
    resultCount: results.length,
    userId: req.user?.id || null,
  });

  sendSuccess(res, results, 'Game results retrieved');
});

module.exports = {
  getGameResultsByDate,
};

