const express = require('express');
const router = express.Router();
const { getGameRates } = require('./markets.controller');
const { requireAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');

router.get('/rates', requireAuth, userLimiter, getGameRates);

module.exports = router;
