const { sendSuccess, sendPaginated } = require('@utils');
const asyncHandler = require('@utils/asyncHandler');
const walletService = require('./wallet.service');

const getWallet = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const wallet = await walletService.getWallet(userId);
  sendSuccess(res, wallet, 'Wallet retrieved successfully');
});

const getTransactions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;

  const { documents, pagination } = await walletService.getTransactions(userId, page, limit);
  sendPaginated(res, documents, pagination, 'Transaction history retrieved');
});

const adminCredit = asyncHandler(async (req, res) => {
  const { userId, amount } = req.body;
  const result = await walletService.adminCredit({ userId, amount });
  sendSuccess(res, result, 'Wallet credited successfully');
});

module.exports = {
  getWallet,
  getTransactions,
  adminCredit,
};
