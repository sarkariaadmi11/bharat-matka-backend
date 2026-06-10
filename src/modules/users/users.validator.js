const {
  DEPOSIT_PROVIDER,
  DEPOSIT_STATUS,
  WITHDRAWAL_METHOD,
  WITHDRAWAL_STATUS,
} = require('@config/constants/payments');
const { ValidationError } = require('@utils/errors');

const ALLOWED_DEPOSIT_QUERY_KEYS = new Set([
  'page',
  'limit',
  'status',
  'provider',
  'fromDate',
  'toDate',
]);

const ALLOWED_WITHDRAWAL_QUERY_KEYS = new Set([
  'page',
  'limit',
  'status',
  'method',
  'fromDate',
  'toDate',
]);

const parsePositiveInt = (value, field, defaultValue) => {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`${field} must be a positive integer`);
  }

  return parsed;
};

const normalizeDateBoundary = (value, boundary) => {
  if (value === undefined) {
    return undefined;
  }

  const raw = String(value).trim();
  if (!raw) {
    throw new ValidationError(`${boundary}Date must be a valid date`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const suffix = boundary === 'from' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
    return new Date(`${raw}${suffix}`);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${boundary}Date must be a valid date`);
  }

  return parsed;
};

const validateAllowedKeys = (query, allowedKeys) => {
  for (const key of Object.keys(query || {})) {
    if (!allowedKeys.has(key)) {
      throw new ValidationError(`Unsupported query parameter: ${key}`);
    }
  }
};

const buildHistoryQuery = ({
  query,
  allowedKeys,
  allowedStatuses,
  allowedSecondaryValues,
  secondaryKey,
}) => {
  validateAllowedKeys(query, allowedKeys);

  const page = parsePositiveInt(query.page, 'page', 1);
  const limit = parsePositiveInt(query.limit, 'limit', 20);

  if (limit > 100) {
    throw new ValidationError('limit must be less than or equal to 100');
  }

  const normalized = {
    page,
    limit,
  };

  if (query.status !== undefined) {
    const status = String(query.status).trim();
    if (!allowedStatuses.has(status)) {
      throw new ValidationError('Invalid status');
    }
    normalized.status = status;
  }

  if (query[secondaryKey] !== undefined) {
    const value = String(query[secondaryKey]).trim();
    if (!allowedSecondaryValues.has(value)) {
      throw new ValidationError(`Invalid ${secondaryKey}`);
    }
    normalized[secondaryKey] = value;
  }

  normalized.fromDate = normalizeDateBoundary(query.fromDate, 'from');
  normalized.toDate = normalizeDateBoundary(query.toDate, 'to');

  if (normalized.fromDate && normalized.toDate && normalized.fromDate > normalized.toDate) {
    throw new ValidationError('fromDate must be less than or equal to toDate');
  }

  return normalized;
};

const validateDepositHistoryQuery = (query = {}) =>
  buildHistoryQuery({
    query,
    allowedKeys: ALLOWED_DEPOSIT_QUERY_KEYS,
    allowedStatuses: new Set(Object.values(DEPOSIT_STATUS)),
    allowedSecondaryValues: new Set([
      DEPOSIT_PROVIDER.RAZORPAY,
      DEPOSIT_PROVIDER.UPI_INTENT,
    ]),
    secondaryKey: 'provider',
  });

const validateWithdrawalHistoryQuery = (query = {}) =>
  buildHistoryQuery({
    query,
    allowedKeys: ALLOWED_WITHDRAWAL_QUERY_KEYS,
    allowedStatuses: new Set(Object.values(WITHDRAWAL_STATUS)),
    allowedSecondaryValues: new Set(Object.values(WITHDRAWAL_METHOD)),
    secondaryKey: 'method',
  });

module.exports = {
  validateDepositHistoryQuery,
  validateWithdrawalHistoryQuery,
};
