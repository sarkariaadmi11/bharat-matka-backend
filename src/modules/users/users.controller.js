const usersService = require('./users.service');
const { sendSuccess, sendPaginated, sendDataWithMeta } = require('@utils/response');
const asyncHandler = require('@utils/asyncHandler');
const {
  validateDepositHistoryQuery,
  validateWithdrawalHistoryQuery,
} = require('./users.validator');

const getProfile = asyncHandler(async (req, res) => {
  const user = await usersService.getProfile(req.user.id);
  return sendSuccess(res, user, 'Profile fetched');
});

const updateProfile = asyncHandler(async (req, res) => {
  const payload = req.validatedData || req.body;
  const updated = await usersService.updateProfile(req.user.id, payload);
  return sendSuccess(res, updated, 'Profile updated');
});

const getWallet = asyncHandler(async (req, res) => {
  const wallet = await usersService.getWalletSummary(req.user.id);
  return sendSuccess(res, wallet, 'Wallet summary');
});

const getTransactions = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const data = await usersService.getTransactionHistory(req.user.id, page, limit);

  const pagination = {
    page: Number(page),
    limit: Number(limit),
    total: data.total || (data.items ? data.items.length : 0),
  };

  return sendPaginated(res, data.items || data, pagination, 'Transaction history');
});

const getDepositHistory = asyncHandler(async (req, res) => {
  const query = validateDepositHistoryQuery(req.query);
  const result = await usersService.getDepositHistory(req.user.id, query);
  return sendDataWithMeta(res, result.data, result.meta);
});

const getWithdrawalHistory = asyncHandler(async (req, res) => {
  const query = validateWithdrawalHistoryQuery(req.query);
  const result = await usersService.getWithdrawalHistory(req.user.id, query);
  return sendDataWithMeta(res, result.data, result.meta);
});

module.exports = {
  getProfile,
  updateProfile,
  getWallet,
  getTransactions,
  getDepositHistory,
  getWithdrawalHistory,
};
