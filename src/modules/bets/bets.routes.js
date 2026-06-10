const express = require('express');
const router = express.Router();

const {
  placeBet,
  getMyBets,
} = require('./bets.controller');

const { requireAuth } = require('@middleware/auth');
const { userLimiter, actionLimiter } = require('@middleware/rateLimiter');

router.get('/my-bets', requireAuth, userLimiter, getMyBets);
router.post('/place', requireAuth, userLimiter, actionLimiter('PLACE_BET'), placeBet);

module.exports = router;
