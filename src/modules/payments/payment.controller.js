const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils');
const paymentService = require('./payment.service');

const initiateDeposit = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const deposit = await paymentService.createDepositOrder({
    userId: req.user.id,
    amount,
  });

  sendSuccess(res, deposit, 'Deposit order created', 201);
});

const initiateUpiDeposit = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const deposit = await paymentService.initiateUpiDeposit({
    userId: req.user.id,
    amount,
  });

  sendSuccess(res, deposit, 'UPI deposit initiated', 201);
});

const verifyDepositPayment = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  const result = await paymentService.verifyDepositPayment({
    userId: req.user.id,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  sendSuccess(res, result, 'Payment verified');
});

const handleUpiDepositCallback = asyncHandler(async (req, res) => {
  const result = await paymentService.submitUpiCallback({
    userId: req.user.id,
    depositId: req.body.depositId,
    statusFromClient: req.body.statusFromClient,
    txnRef: req.body.txnRef,
    approvalRefNo: req.body.approvalRefNo,
    transactionId: req.body.transactionId,
    responseCode: req.body.responseCode,
    rawResponse: req.body.rawResponse,
  });

  sendSuccess(res, result, result.message);
});

const getUpiDepositStatus = asyncHandler(async (req, res) => {
  const result = await paymentService.getUpiDepositStatus({
    userId: req.user.id,
    depositId: req.params.depositId,
  });

  sendSuccess(res, result, result.message);
});

const getDepositHistory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const { status } = req.query;
  const result = await paymentService.getDepositHistory({
    userId: req.user.id,
    page,
    limit,
    status,
  });

  sendSuccess(res, result, 'Deposit history retrieved');
});

const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const result = await paymentService.handleWebhookEvent({
    event: req.body?.event,
    payload: req.body?.payload,
    rawBody: req.rawBody,
    signature,
  });

  sendSuccess(res, result, 'Webhook processed');
});

const requestWithdrawal = asyncHandler(async (req, res) => {
  const {
    amount,
    method,
    bankAccountId,
    idempotencyKey,
  } = req.body;

  const payout = await paymentService.requestWithdrawal({
    userId: req.user.id,
    amount,
    method,
    bankAccountId,
    idempotencyKey,
  });

  sendSuccess(res, payout, 'Withdrawal request submitted', 201);
});

module.exports = {
  initiateDeposit,
  initiateUpiDeposit,
  verifyDepositPayment,
  handleUpiDepositCallback,
  getUpiDepositStatus,
  getDepositHistory,
  handleRazorpayWebhook,
  requestWithdrawal,
};
