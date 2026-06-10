const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils/response');
const adminUserService = require('./adminUser.service');
const {
  ensureObjectId,
  ensureBetReference,
  validateListQuery,
  parsePagination,
  validateTransactionQuery,
  validateWithdrawalQuery,
  validateWalletAdjustmentPayload,
  validateBetEditPayload,
  validateResetPasswordPayload,
} = require('./adminUser.validator');

const listUsers = asyncHandler(async (req, res) => {
  validateListQuery(req.query);
  const result = await adminUserService.listUsers(req.query);
  sendSuccess(res, result, 'Users retrieved');
});

const getUserDetails = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  const result = await adminUserService.getUserDetails(req.params.id);
  sendSuccess(res, result, 'User details retrieved');
});

const blockUser = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  const result = await adminUserService.blockUser(req.params.id);
  sendSuccess(res, result, 'User blocked');
});

const unblockUser = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  const result = await adminUserService.unblockUser(req.params.id);
  sendSuccess(res, result, 'User unblocked');
});

const getUserStats = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  const result = await adminUserService.getUserStats(req.params.id);
  sendSuccess(res, result, 'User stats retrieved');
});

const getUserBets = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  const pagination = parsePagination(req.query);
  const result = await adminUserService.getUserBets(req.params.id, {
    ...req.query,
    ...pagination,
  });
  sendSuccess(res, result, 'User bets retrieved');
});

const getUserTransactions = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  const query = validateTransactionQuery(req.query);
  const result = await adminUserService.getUserTransactions(req.params.id, query);
  sendSuccess(res, result, 'User transactions retrieved');
});

const deleteUserTransaction = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  ensureObjectId(req.params.transactionId, 'transaction id');
  const result = await adminUserService.deleteUserTransaction({
    userId: req.params.id,
    transactionId: req.params.transactionId,
    adminUserId: req.user?.id,
  });
  sendSuccess(res, result, 'Transaction deleted');
});

const getUserWithdrawals = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  const query = validateWithdrawalQuery(req.query);
  const result = await adminUserService.getUserWithdrawals(req.params.id, query);
  sendSuccess(res, result, 'User withdrawal requests retrieved');
});

const updateUserBet = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  ensureBetReference(req.params.betId, 'bet id');
  const payload = validateBetEditPayload(req.body);
  const result = await adminUserService.updateUserBet({
    userId: req.params.id,
    betId: req.params.betId,
    payload,
    adminUserId: req.user?.id,
  });
  sendSuccess(res, result, 'User bet updated');
});

const deleteUserBet = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  ensureBetReference(req.params.betId, 'bet id');
  const result = await adminUserService.deleteUserBet({
    userId: req.params.id,
    betId: req.params.betId,
    adminUserId: req.user?.id,
  });
  sendSuccess(res, result, 'User bet deleted');
});

const createWalletAdjustment = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  const payload = validateWalletAdjustmentPayload(req.body);
  const result = await adminUserService.adjustFunds({
    userId: req.params.id,
    ...payload,
    adminUserId: req.user?.id,
  });
  sendSuccess(res, result, 'Wallet adjustment recorded');
});

const resetUserPassword = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'user id');
  const payload = validateResetPasswordPayload(req.body);
  const result = await adminUserService.resetUserPassword(req.params.id, payload);
  sendSuccess(res, result, 'User password reset');
});

module.exports = {
  listUsers,
  getUserDetails,
  blockUser,
  unblockUser,
  getUserStats,
  getUserBets,
  getUserTransactions,
  deleteUserTransaction,
  getUserWithdrawals,
  updateUserBet,
  deleteUserBet,
  createWalletAdjustment,
  resetUserPassword,
};
