const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess, sendPaginated } = require('@utils');
const paymentService = require('../../payments/payment.service');
const analyticsService = require('../analytics/adminAnalytics.service');
const analyticsValidator = require('../analytics/adminAnalytics.validator');
const { sendAnalyticsSuccess } = require('@utils');

const listWithdrawals = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const { status } = req.query;

  const { documents, pagination } = await paymentService.getWithdrawals({
    status,
    page,
    limit,
  });

  sendPaginated(res, documents, pagination, 'Withdrawals fetched');
});

const approveWithdrawal = asyncHandler(async (req, res) => {
  const { payoutId } = req.params;
  const { adminRemarks } = req.body;

  const result = await paymentService.approveWithdrawal({
    payoutId,
    adminUserId: req.user.id,
    adminRemarks,
  });

  sendSuccess(res, result, 'Withdrawal approved');
});

const deleteWithdrawal = asyncHandler(async (req, res) => {
  const { payoutId } = req.params;

  const result = await paymentService.deleteWithdrawal({
    payoutId,
    adminUserId: req.user.id,
  });

  sendSuccess(res, result, 'Withdrawal request deleted');
});

const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { payoutId } = req.params;
  const { adminRemarks } = req.body;

  const result = await paymentService.rejectWithdrawal({
    payoutId,
    adminUserId: req.user.id,
    adminRemarks,
  });

  sendSuccess(res, result, 'Withdrawal rejected');
});

const listTransactionLogs = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const { userId } = req.query;

  const { documents, pagination } = await paymentService.getPaymentTransactionLogs({
    page,
    limit,
    userId,
  });

  sendPaginated(res, documents, pagination, 'Payment transaction logs fetched');
});

const listDepositHistory = asyncHandler(async (req, res) => {
  const query = analyticsValidator.validateDepositHistoryQuery(req.query);
  const payload = await analyticsService.getAdminDepositHistory(query);
  return sendAnalyticsSuccess(req, res, {
    message: 'Deposit history retrieved',
    data: payload.data,
    pagination: payload.pagination,
    meta: payload.meta,
  });
});

const deleteDeposit = asyncHandler(async (req, res) => {
  const { depositId } = req.params;

  const result = await paymentService.deleteDeposit({
    depositId,
    adminUserId: req.user.id,
  });

  sendSuccess(res, result, 'Deposit deleted');
});

const createDeposit = asyncHandler(async (req, res) => {
  const { userId, amount, adminRemarks } = req.body;

  const result = await paymentService.createAdminDeposit({
    userId,
    amount,
    adminUserId: req.user.id,
    adminRemarks,
  });

  sendSuccess(res, result, 'Deposit created', 201);
});

const getMerchantUpiConfig = asyncHandler(async (_req, res) => {
  const result = await paymentService.getMerchantUpiConfig();
  sendSuccess(res, result, 'Merchant UPI config fetched');
});

const saveMerchantUpiConfig = asyncHandler(async (req, res) => {
  const result = await paymentService.saveMerchantUpiConfig({
    upiId: req.body?.upiId,
  });

  sendSuccess(res, result, 'Merchant UPI config saved');
});

module.exports = {
  listWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  deleteWithdrawal,
  listTransactionLogs,
  listDepositHistory,
  deleteDeposit,
  createDeposit,
  getMerchantUpiConfig,
  saveMerchantUpiConfig,
};
