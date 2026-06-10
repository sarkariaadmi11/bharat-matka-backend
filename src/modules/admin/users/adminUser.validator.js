const mongoose = require('mongoose');
const { TRANSACTION_TYPE } = require('@config/constants/domain');
const { ValidationError } = require('@utils/errors');
const { parseExpandedBetReference } = require('@modules/bets/betProjection.service');

const ALLOWED_STATUS_QUERY = new Set(['active', 'blocked']);
const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'lastLoginAt', 'username']);
const ALLOWED_ORDER = new Set(['asc', 'desc']);
const ALLOWED_TRANSACTION_TYPES = new Set(Object.values(TRANSACTION_TYPE));
const ALLOWED_WITHDRAWAL_STATUSES = new Set(['pending', 'approved', 'rejected', 'processing', 'success', 'failed', 'reversed']);
const ALLOWED_WITHDRAWAL_METHODS = new Set(['upi', 'bank']);

const ensureObjectId = (value, label = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError(`Invalid ${label}`);
  }
};

const ensureBetReference = (value, label = 'bet id') => {
  const parsed = parseExpandedBetReference(value);

  if (!mongoose.Types.ObjectId.isValid(parsed.storedBetId)) {
    throw new ValidationError(`Invalid ${label}`);
  }

  if (parsed.isExpanded && !String(parsed.expansionKey || '').trim()) {
    throw new ValidationError(`Invalid ${label}`);
  }

  return parsed;
};

const validateListQuery = (query = {}) => {
  if (query.status && !ALLOWED_STATUS_QUERY.has(query.status)) {
    throw new ValidationError('status must be active or blocked');
  }

  if (query.sortBy && !ALLOWED_SORT_FIELDS.has(query.sortBy)) {
    throw new ValidationError('Invalid sortBy field');
  }

  if (query.order && !ALLOWED_ORDER.has(query.order)) {
    throw new ValidationError('order must be asc or desc');
  }

  if (query.search && String(query.search).length > 100) {
    throw new ValidationError('search is too long');
  }
};

const parsePagination = (query = {}) => {
  const page = Number.parseInt(query.page, 10) || 1;
  const limit = Number.parseInt(query.limit, 10) || 20;

  if (page < 1) {
    throw new ValidationError('page must be at least 1');
  }

  if (limit < 1 || limit > 100) {
    throw new ValidationError('limit must be between 1 and 100');
  }

  return { page, limit };
};

const validateTransactionQuery = (query = {}) => {
  const pagination = parsePagination(query);

  if (query.type && !ALLOWED_TRANSACTION_TYPES.has(String(query.type).trim().toUpperCase())) {
    throw new ValidationError('Invalid transaction type');
  }

  return {
    ...pagination,
    type: query.type ? String(query.type).trim().toUpperCase() : undefined,
  };
};

const validateWalletAdjustmentPayload = (payload = {}) => {
  const operation = String(payload.operation || '').trim().toLowerCase();
  if (!['credit', 'debit'].includes(operation)) {
    throw new ValidationError('operation must be credit or debit');
  }

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError('amount must be greater than 0');
  }

  const reason = String(payload.reason || '').trim();
  if (!reason) {
    throw new ValidationError('reason is required');
  }

  const idempotencyKey = String(payload.idempotencyKey || '').trim();
  if (!idempotencyKey) {
    throw new ValidationError('idempotencyKey is required');
  }

  return {
    operation,
    amount,
    reason,
    note: payload.note ? String(payload.note).trim() : '',
    idempotencyKey,
    referenceSessionId: payload.referenceSessionId ? String(payload.referenceSessionId).trim() : null,
  };
};

const validateBetEditPayload = (payload = {}) => {
  const next = {};

  if (payload.amount !== undefined) {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError('amount must be greater than 0');
    }
    next.amount = amount;
  }

  const hasValue = Object.prototype.hasOwnProperty.call(payload, 'value');
  const hasSelection = Object.prototype.hasOwnProperty.call(payload, 'selection');
  if (hasValue || hasSelection) {
    const rawValue = hasValue ? payload.value : payload.selection;

    if (typeof rawValue === 'string') {
      const value = rawValue.trim();
      if (!value) {
        throw new ValidationError('value cannot be empty');
      }
      next.value = value;
    } else if (Array.isArray(rawValue)) {
      if (rawValue.length === 0) {
        throw new ValidationError('value cannot be empty');
      }
      next.value = rawValue;
    } else if (rawValue && typeof rawValue === 'object') {
      if (Object.keys(rawValue).length === 0) {
        throw new ValidationError('value cannot be empty');
      }
      next.value = rawValue;
    } else {
      throw new ValidationError('value cannot be empty');
    }
  }

  if (!Object.prototype.hasOwnProperty.call(next, 'amount')
    && !Object.prototype.hasOwnProperty.call(next, 'value')) {
    throw new ValidationError('Provide amount or value to update the bid');
  }

  return next;
};

const validateWithdrawalQuery = (query = {}) => {
  const pagination = parsePagination(query);

  if (query.status && !ALLOWED_WITHDRAWAL_STATUSES.has(String(query.status).trim().toLowerCase())) {
    throw new ValidationError('Invalid withdrawal status');
  }

  if (query.method && !ALLOWED_WITHDRAWAL_METHODS.has(String(query.method).trim().toLowerCase())) {
    throw new ValidationError('method must be upi or bank');
  }

  return {
    ...pagination,
    status: query.status ? String(query.status).trim().toLowerCase() : undefined,
    method: query.method ? String(query.method).trim().toLowerCase() : undefined,
    fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
    toDate: query.toDate ? new Date(query.toDate) : undefined,
  };
};

const validateResetPasswordPayload = (payload = {}) => {
  const newPassword = String(payload.newPassword || '');
  if (newPassword.length < 6) {
    throw new ValidationError('newPassword must be at least 6 characters');
  }

  return { newPassword };
};

module.exports = {
  ensureObjectId,
  ensureBetReference,
  validateListQuery,
  parsePagination,
  validateTransactionQuery,
  validateWithdrawalQuery,
  validateFundsPayload: validateWalletAdjustmentPayload,
  validateWalletAdjustmentPayload,
  validateBetEditPayload,
  validateResetPasswordPayload,
};
