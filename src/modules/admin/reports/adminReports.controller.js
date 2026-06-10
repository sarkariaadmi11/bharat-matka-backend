const asyncHandler = require('@utils/asyncHandler');
const service = require('./adminReports.service');
const { sendAnalyticsSuccess } = require('@utils');
const {
  validateBidReportQuery,
  validateWinningHistoryQuery,
} = require('./adminReports.validator');

const getBidReport = asyncHandler(async (req, res) => {
  const report = await service.getBidReport(validateBidReportQuery(req.query));
  return sendAnalyticsSuccess(req, res, {
    message: 'Bid report retrieved',
    data: report.data,
    pagination: report.pagination,
    meta: report.meta,
  });
});

const getWinningHistory = asyncHandler(async (req, res) => {
  const report = await service.getWinningHistory(validateWinningHistoryQuery(req.query));
  return sendAnalyticsSuccess(req, res, {
    message: 'Winning history retrieved',
    data: report.data,
    pagination: report.pagination,
    meta: report.meta,
  });
});

module.exports = {
  getBidReport,
  getWinningHistory,
};
