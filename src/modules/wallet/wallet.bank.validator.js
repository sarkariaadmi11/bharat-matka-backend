const mongoose = require('mongoose');
const { ValidationError } = require('@utils/errors');

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_PATTERN = /^[0-9]{6,20}$/;

const parseOptionalBoolean = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }
  throw new ValidationError(`${fieldName} must be a boolean`);
};

const ensureObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError(`Invalid ${label}`);
  }
};

const validateCreateBankAccountPayload = (body = {}) => {
  const accountHolderName = String(body.accountHolderName || '').trim();
  const bankName = String(body.bankName || '').trim();
  const accountNumber = String(body.accountNumber || '').trim();
  const ifscCode = String(body.ifscCode || '').trim().toUpperCase();
  const upiId = body.upiId !== undefined && body.upiId !== null
    ? String(body.upiId).trim().toLowerCase()
    : undefined;
  const isPrimary = body.isPrimary !== undefined
    ? parseOptionalBoolean(body.isPrimary, 'isPrimary')
    : parseOptionalBoolean(body.isDefault, 'isDefault');

  if (!accountHolderName) {
    throw new ValidationError('accountHolderName is required');
  }
  if (!bankName) {
    throw new ValidationError('bankName is required');
  }
  if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
    throw new ValidationError('accountNumber must be 6-20 digits');
  }
  if (!IFSC_PATTERN.test(ifscCode)) {
    throw new ValidationError('ifscCode must be a valid IFSC code');
  }
  if (upiId !== undefined && upiId.length > 100) {
    throw new ValidationError('upiId is too long');
  }

  return {
    accountHolderName,
    bankName,
    accountNumber,
    ifscCode,
    upiId,
    isPrimary,
  };
};

const validateUpiAccountPayload = (body = {}) => {
  const accountHolderName = String(body.accountHolderName || '').trim();
  const upiId = String(body.upiId || '').trim().toLowerCase();
  const isPrimary = body.isPrimary !== undefined
    ? parseOptionalBoolean(body.isPrimary, 'isPrimary')
    : parseOptionalBoolean(body.isDefault, 'isDefault');

  if (!accountHolderName) {
    throw new ValidationError('accountHolderName is required');
  }

  if (!upiId) {
    throw new ValidationError('upiId is required');
  }

  if (upiId.length > 100) {
    throw new ValidationError('upiId is too long');
  }

  return {
    accountHolderName,
    upiId,
    isPrimary,
  };
};

module.exports = {
  ensureObjectId,
  validateCreateBankAccountPayload,
  validateUpiAccountPayload,
};
