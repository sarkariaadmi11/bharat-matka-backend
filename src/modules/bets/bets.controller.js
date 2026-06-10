const betsService = require('./bets.service');
const {
  validateGetMyBetsQuery,
} = require('./bets.validator');
const { sendSuccess, sendPaginated } = require('@utils/response');
const asyncHandler = require('@utils/asyncHandler');

const placeBet = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { sessionId, gameTypeId, bets } = req.body;

  const result = await betsService.placeBetsFromRequest({
    userId,
    sessionId,
    gameTypeId,
    bets,
  });

  sendSuccess(res, result, 'Bets placed successfully', 201);
});

const getMyBets = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page, limit, date, market, gameType } = validateGetMyBetsQuery(req.query);

  const data = await betsService.getUserBets(userId, page, limit, { date, market, gameType });

  return sendPaginated(
    res,
    data.items,
    { page, limit, total: data.total },
    'Bet history retrieved',
  );
});

module.exports = {
  getMyBets,
  placeBet,
};
