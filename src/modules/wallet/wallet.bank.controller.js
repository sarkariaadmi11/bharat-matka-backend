const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils');
const walletBankService = require('./wallet.bank.service');
const {
  ensureObjectId,
  validateCreateBankAccountPayload,
  validateUpiAccountPayload,
} = require('./wallet.bank.validator');

const addBankAccount = asyncHandler(async (req, res) => {
  const payload = validateCreateBankAccountPayload(req.body);
  const result = await walletBankService.createBankAccount(req.user.id, payload);
  sendSuccess(res, result, 'Bank account added', 201);
});

const listBankAccounts = asyncHandler(async (req, res) => {
  const result = await walletBankService.listUserBankAccounts(req.user.id);
  sendSuccess(res, result, 'Bank accounts retrieved');
});

const getUpiAccount = asyncHandler(async (req, res) => {
  const result = await walletBankService.getUserUpiAccount(req.user.id);
  sendSuccess(res, result, 'UPI account retrieved');
});

const upsertUpiAccount = asyncHandler(async (req, res) => {
  const payload = validateUpiAccountPayload(req.body);
  const result = await walletBankService.upsertUserUpiAccount(req.user.id, payload);
  sendSuccess(res, result, 'UPI account saved');
});

const deleteBankAccount = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'bank account id');
  const result = await walletBankService.deleteBankAccount(req.user.id, req.params.id);
  sendSuccess(res, result, 'Bank account removed');
});

module.exports = {
  addBankAccount,
  listBankAccounts,
  getUpiAccount,
  upsertUpiAccount,
  deleteBankAccount,
};
