const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils');
const service = require('./adminMarkets.service');
const {
  ensureObjectId,
  validateCreateMarketPayload,
  validateEditMarketPayload,
  validateListMarketsQuery,
} = require('./adminMarkets.validator');

const createMarket = asyncHandler(async (req, res) => {
  const payload = validateCreateMarketPayload(req.body);
  const market = await service.createMarket({
    payload,
    adminUserId: req.user.id,
    req,
  });
  return sendSuccess(res, market, 'Market created successfully', 201);
});

const getMarkets = asyncHandler(async (req, res) => {
  const query = validateListMarketsQuery(req.query);
  const markets = await service.getAdminMarkets(query);
  return sendSuccess(res, markets, 'Admin markets retrieved successfully');
});

const updateMarket = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.marketId, 'marketId');
  const payload = validateEditMarketPayload(req.body);
  const market = await service.editMarket({
    marketId: req.params.marketId,
    payload,
    adminUserId: req.user.id,
    req,
  });
  return sendSuccess(res, market, 'Market updated successfully');
});

const deleteMarket = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.marketId, 'marketId');
  const result = await service.deleteMarket({
    marketId: req.params.marketId,
    adminUserId: req.user.id,
    req,
  });
  return sendSuccess(res, result, 'Market deleted successfully');
});

const getMarketGameTypes = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.marketId, 'marketId');
  const result = await service.getMarketGameTypes(req.params.marketId);
  return sendSuccess(res, result, 'Market game types retrieved successfully');
});

module.exports = {
  createMarket,
  getMarkets,
  updateMarket,
  deleteMarket,
  getMarketGameTypes,
};
