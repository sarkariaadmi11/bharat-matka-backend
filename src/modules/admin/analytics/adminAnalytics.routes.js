const express = require('express');
const { requireAdminAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');
const controller = require('./adminAnalytics.controller');

const router = express.Router();

router.get('/dashboard/summary', ...requireAdminAuth, userLimiter, controller.getDashboardSummary);
router.get('/markets/:marketId/digits', ...requireAdminAuth, userLimiter, controller.getMarketDigitSummary);
router.get('/markets/:marketId/bids', ...requireAdminAuth, userLimiter, controller.getMarketBidSummary);
router.get('/reports/profit-loss', ...requireAdminAuth, userLimiter, controller.getProfitLossReport);

module.exports = router;
