const { RepositoryFactory } = require('@infra/database');
const { ValidationError, NotFoundError } = require('@utils/errors');

const bankDetailRepository = RepositoryFactory.getRepository('BankDetail');
const payoutRepository = RepositoryFactory.getRepository('Payout');

const MAX_BANK_ACCOUNTS_PER_USER = 5;

const maskAccountNumber = (value = '') => {
  const account = String(value);
  if (!account || account === 'null' || account === 'undefined') {
    return null;
  }
  if (account.length <= 4) {
    return account;
  }
  return `${'*'.repeat(account.length - 4)}${account.slice(-4)}`;
};

const normalizeBankDetail = (bankDetail) => {
  const data = bankDetail.toObject ? bankDetail.toObject() : bankDetail;
  return {
    ...data,
    accountNumber: maskAccountNumber(data.accountNumber),
    isPrimary: Boolean(data.isDefault),
  };
};

const normalizeUpiAccount = (bankDetail) => {
  if (!bankDetail) {
    return null;
  }

  const data = bankDetail.toObject ? bankDetail.toObject() : bankDetail;
  return {
    id: data._id,
    userId: data.userId,
    accountHolderName: data.accountHolderName || null,
    upiId: data.upiId || null,
    bankAccountId: data._id,
    isDefault: Boolean(data.isDefault),
    isPrimary: Boolean(data.isDefault),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
};

const createBankAccount = async (userId, data) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }

  const existingCount = await bankDetailRepository.countBankAccountsByUserId(userId);
  if (existingCount >= MAX_BANK_ACCOUNTS_PER_USER) {
    throw new ValidationError(`You can add up to ${MAX_BANK_ACCOUNTS_PER_USER} bank accounts`);
  }

  const shouldBePrimary = data.isPrimary === true || (existingCount === 0 && data.isPrimary !== false);
  if (shouldBePrimary) {
    await bankDetailRepository.updateMany({ userId }, { isDefault: false });
  }

  const bankDetail = await bankDetailRepository.create({
    userId,
    accountHolderName: data.accountHolderName,
    bankName: data.bankName,
    accountNumber: data.accountNumber,
    ifscCode: data.ifscCode,
    upiId: data.upiId || undefined,
    isDefault: shouldBePrimary,
  });

  return normalizeBankDetail(bankDetail);
};

const listUserBankAccounts = async (userId) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }

  const bankDetails = await bankDetailRepository.findBankAccountsByUserId(userId);
  return bankDetails.map(normalizeBankDetail);
};

const getUserUpiAccount = async (userId) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }

  const preferredUpi = await bankDetailRepository.findPreferredUpiByUserId(userId);
  if (preferredUpi) {
    return normalizeUpiAccount(preferredUpi);
  }

  const primaryAccount = await bankDetailRepository.findPrimaryByUserId(userId);
  if (primaryAccount?.upiId) {
    return normalizeUpiAccount(primaryAccount);
  }

  return null;
};

const upsertUserUpiAccount = async (userId, data) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }

  let target = await bankDetailRepository.findPreferredUpiByUserId(userId);

  if (!target) {
    target = await bankDetailRepository.findPrimaryByUserId(userId);
  }

  if (data.isPrimary === true) {
    await bankDetailRepository.updateMany({ userId }, { isDefault: false });
  }

  if (target) {
    target.accountHolderName = data.accountHolderName;
    target.upiId = data.upiId;
    if (data.isPrimary !== undefined) {
      target.isDefault = data.isPrimary;
    }
    await target.save();
    return normalizeUpiAccount(target);
  }

  const bankDetail = await bankDetailRepository.create({
    userId,
    accountHolderName: data.accountHolderName,
    bankName: null,
    accountNumber: null,
    ifscCode: null,
    upiId: data.upiId,
    isDefault: data.isPrimary !== undefined ? data.isPrimary : true,
  });

  return normalizeUpiAccount(bankDetail);
};

const deleteBankAccount = async (userId, bankAccountId) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }
  if (!bankAccountId) {
    throw new ValidationError('Bank account ID is required');
  }

  const pendingPayouts = await payoutRepository.countPendingByBankDetail(bankAccountId);
  if (pendingPayouts > 0) {
    throw new ValidationError('Bank account has pending withdrawal requests');
  }

  const deletedBankDetail = await bankDetailRepository.deleteByUserAndId(userId, bankAccountId);
  if (!deletedBankDetail) {
    throw new NotFoundError('Bank account not found');
  }

  if (deletedBankDetail.isDefault) {
    const remaining = await bankDetailRepository.findByUserId(userId);
    if (remaining.length > 0) {
      await bankDetailRepository.update(remaining[0]._id, { isDefault: true });
    }
  }

  return normalizeBankDetail(deletedBankDetail);
};

module.exports = {
  createBankAccount,
  listUserBankAccounts,
  getUserUpiAccount,
  upsertUserUpiAccount,
  deleteBankAccount,
};
