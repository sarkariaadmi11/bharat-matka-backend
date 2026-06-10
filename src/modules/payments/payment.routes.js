const express = require('express');
const router = express.Router();

const paymentController = require('./payment.controller');
const { requireAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');

router.post('/deposits/initiate', requireAuth, userLimiter, paymentController.initiateDeposit);
router.post('/deposits/initiate-upi', requireAuth, userLimiter, paymentController.initiateUpiDeposit);
router.get('/deposits/history', requireAuth, userLimiter, paymentController.getDepositHistory);
router.post('/deposits/verify', requireAuth, userLimiter, paymentController.verifyDepositPayment);
router.post('/deposits/upi-callback', requireAuth, userLimiter, paymentController.handleUpiDepositCallback);
router.get('/deposits/:depositId/status', requireAuth, userLimiter, paymentController.getUpiDepositStatus);
router.post('/webhook/razorpay', paymentController.handleRazorpayWebhook);
router.post('/withdrawals/request', requireAuth, userLimiter, paymentController.requestWithdrawal);

module.exports = router;
