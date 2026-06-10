const { sendSuccess } = require('@utils/response');
const asyncHandler = require('@utils/asyncHandler');
const marketsService = require('./markets.service');

const getMarkets = asyncHandler(async (req, res) => {
  const marketsWithStatus = await marketsService.getMarketsWithStatus();
  sendSuccess(res, marketsWithStatus, 'Markets retrieved');
});

const getTodaysResults = asyncHandler(async (req, res) => {
  const data = await marketsService.getTodaysResults();
  return sendSuccess(res, data, 'Today market results retrieved');
});

const getMarketStatus = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const data = await marketsService.getMarketStatus(code);
  sendSuccess(res, data, 'Market status retrieved');
});

const getGameRates = asyncHandler(async (req, res) => {
  const rates = await marketsService.getGameRates();
  return sendSuccess(res, rates, 'Game rates retrieved');
});

module.exports = {
  getMarkets,
  getTodaysResults,
  getMarketStatus,
  getGameRates,
};
