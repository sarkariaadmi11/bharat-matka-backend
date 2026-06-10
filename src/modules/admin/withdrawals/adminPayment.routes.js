const express = require('express');
const router = express.Router();

const adminPaymentController = require('./adminPayment.controller');
const { requireAuth, requireAdmin } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');

router.get(
  '/transactions',
  requireAuth,
  userLimiter,
  requireAdmin,
  adminPaymentController.listTransactionLogs,
);

router.get(
  '/deposits/history',
  requireAuth,
  userLimiter,
  requireAdmin,
  adminPaymentController.listDepositHistory,
);

router.post(
  '/deposits',
  requireAuth,
  userLimiter,
  requireAdmin,
  adminPaymentController.createDeposit,
);

router.delete(
  '/deposits/:depositId',
  requireAuth,
  userLimiter,
  requireAdmin,
  adminPaymentController.deleteDeposit,
);

router.get('/merchant-upi', requireAuth, userLimiter, requireAdmin, adminPaymentController.getMerchantUpiConfig);
router.post('/merchant-upi', requireAuth, userLimiter, requireAdmin, adminPaymentController.saveMerchantUpiConfig);

router.get('/withdrawals', requireAuth, userLimiter, requireAdmin, adminPaymentController.listWithdrawals);

router.post(
  '/withdrawals/:payoutId/approve',
  requireAuth,
  userLimiter,
  requireAdmin,
  adminPaymentController.approveWithdrawal,
);

router.post(
  '/withdrawals/:payoutId/reject',
  requireAuth,
  userLimiter,
  requireAdmin,
  adminPaymentController.rejectWithdrawal,
);

router.delete(
  '/withdrawals/:payoutId',
  requireAuth,
  userLimiter,
  requireAdmin,
  adminPaymentController.deleteWithdrawal,
);

module.exports = router;
