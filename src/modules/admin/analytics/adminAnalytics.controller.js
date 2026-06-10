const asyncHandler = require('@utils/asyncHandler');
const { sendAnalyticsSuccess } = require('@utils');
const service = require('./adminAnalytics.service');
const validator = require('./adminAnalytics.validator');
const { DateTime } = require('luxon');
const { BUSINESS_TIMEZONE } = require('@utils/timezoneHelper');

const businessDateToday = () => DateTime.now().setZone(BUSINESS_TIMEZONE).toISODate();

const getDashboardSummary = asyncHandler(async (req, res) => {
  validator.validateDashboardSummaryQuery(req.query);
  const payload = await service.getDashboardSummary({ businessDate: businessDateToday() });
  return sendAnalyticsSuccess(req, res, {
    message: 'Admin dashboard summary retrieved',
    data: payload.data,
    meta: payload.meta,
  });
});

const getMarketDigitSummary = asyncHandler(async (req, res) => {
  const query = validator.validateMarketDigitSummaryQuery(req);
  const payload = await service.getMarketDigitSummary(query);
  return sendAnalyticsSuccess(req, res, {
    message: 'Market digit summary retrieved',
    data: payload.data,
    meta: payload.meta,
  });
});

const getMarketBidSummary = asyncHandler(async (req, res) => {
  const query = validator.validateMarketBidSummaryQuery(req);
  const payload = await service.getMarketBidSummary(query);
  return sendAnalyticsSuccess(req, res, {
    message: 'Market bid summary retrieved',
    data: payload.data,
    meta: payload.meta,
  });
});

const getProfitLossReport = asyncHandler(async (req, res) => {
  const query = validator.validateProfitLossQuery(req.query);
  const payload = await service.getProfitLossReport(query);
  return sendAnalyticsSuccess(req, res, {
    message: 'Profit/loss report retrieved',
    data: payload.data,
    pagination: payload.pagination,
    meta: payload.meta,
  });
});

const getBidReport = asyncHandler(async (req, res) => {
  const query = validator.validateBidReportQuery(req.query);
  const payload = await service.getBidReport(query);
  return sendAnalyticsSuccess(req, res, {
    message: 'Bid report retrieved',
    data: payload.data,
    pagination: payload.pagination,
    meta: payload.meta,
  });
});

const getWinningHistory = asyncHandler(async (req, res) => {
  const query = validator.validateWinningHistoryQuery(req.query);
  const payload = await service.getWinningHistory(query);
  return sendAnalyticsSuccess(req, res, {
    message: 'Winning history retrieved',
    data: payload.data,
    pagination: payload.pagination,
    meta: payload.meta,
  });
});

const getAdminDepositHistory = asyncHandler(async (req, res) => {
  const query = validator.validateDepositHistoryQuery(req.query);
  const payload = await service.getAdminDepositHistory(query);
  return sendAnalyticsSuccess(req, res, {
    message: 'Deposit history retrieved',
    data: payload.data,
    pagination: payload.pagination,
    meta: payload.meta,
  });
});

module.exports = {
  getDashboardSummary,
  getMarketDigitSummary,
  getMarketBidSummary,
  getProfitLossReport,
  getBidReport,
  getWinningHistory,
  getAdminDepositHistory,
};
