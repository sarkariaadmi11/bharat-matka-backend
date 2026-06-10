const express = require('express');
const router = express.Router();
const { requireAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');
const {
  getProfile,
  getWallet,
  getTransactions,
  getDepositHistory,
  getWithdrawalHistory,
} = require('./users.controller');
const { getMyBets } = require('../bets/bets.controller');

router.get('/my/profile', requireAuth, userLimiter, getProfile);
router.get('/my/wallet', requireAuth, userLimiter, getWallet);
router.get('/my/transactions', requireAuth, userLimiter, getTransactions);
router.get('/my/deposits', requireAuth, userLimiter, getDepositHistory);
router.get('/my/withdrawals', requireAuth, userLimiter, getWithdrawalHistory);
router.get('/my/bets', requireAuth, userLimiter, getMyBets);

module.exports = router;

