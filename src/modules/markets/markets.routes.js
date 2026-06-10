const express = require('express');
const router = express.Router();
const {
  getMarkets,
  getMarketStatus,
  getTodaysResults,
} = require('./markets.controller');

router.get('/', getMarkets);
router.get('/results/today', getTodaysResults);
router.get('/:code/status', getMarketStatus);

module.exports = router;
