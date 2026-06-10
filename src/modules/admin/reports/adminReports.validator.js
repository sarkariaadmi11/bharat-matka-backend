const analyticsValidator = require('../analytics/adminAnalytics.validator');

module.exports = {
  validateBidReportQuery: (query) => analyticsValidator.validateBidReportQuery(query),
  validateWinningHistoryQuery: (query) => analyticsValidator.validateWinningHistoryQuery({
    ...query,
    sortBy: query.sortBy === 'payout' ? 'recordedPayout' : query.sortBy === 'amount' ? 'betAmount' : query.sortBy,
  }),
  validateProfitLossReportQuery: (query) => analyticsValidator.validateProfitLossQuery(query),
};
