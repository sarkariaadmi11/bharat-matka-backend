const express = require('express');
const router = express.Router();

const {
  getWallet,
  getTransactions,
  adminCredit,
} = require('./wallet.controller');
const {
  addBankAccount,
  listBankAccounts,
  getUpiAccount,
  upsertUpiAccount,
  deleteBankAccount,
} = require('./wallet.bank.controller');

const { requireAuth, requireAdmin } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');

router.get('/', requireAuth, userLimiter, getWallet);
router.get('/transactions', requireAuth, userLimiter, getTransactions);
router.post('/admin/credit', requireAuth, userLimiter, requireAdmin, adminCredit);
router.get('/upi-account', requireAuth, userLimiter, getUpiAccount);
router.post('/upi-account', requireAuth, userLimiter, upsertUpiAccount);
router.post('/bank-accounts', requireAuth, userLimiter, addBankAccount);
router.get('/bank-accounts', requireAuth, userLimiter, listBankAccounts);
router.delete('/bank-accounts/:id', requireAuth, userLimiter, deleteBankAccount);

module.exports = router;
