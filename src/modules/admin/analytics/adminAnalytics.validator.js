const Joi = require('joi');
const mongoose = require('mongoose');
const config = require('@config');
const { DEPOSIT_PROVIDER, DEPOSIT_STATUS } = require('@config/constants/payments');
const { BET_MODE, BET_STATUS } = require('@config/constants/domain');
const { ValidationError } = require('@utils/errors');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const basePaginationSchema = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(config.ANALYTICS_MAX_LIMIT).default(config.ANALYTICS_DEFAULT_LIMIT),
  order: Joi.string().valid('asc', 'desc').default('desc'),
};

const validateObjectId = (value, label) => {
  if (value && !mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError(`Invalid ${label}`, [`${label} must be a valid ObjectId`], {
      code: 'ANALYTICS_VALIDATION_ERROR',
    });
  }
};

const validateDateRange = ({ fromDate, toDate }) => {
  if (!fromDate && !toDate) {
    return;
  }

  if (!fromDate || !toDate) {
    throw new ValidationError(
      'Validation failed',
      ['fromDate and toDate must be provided together'],
      { code: 'ANALYTICS_VALIDATION_ERROR' },
    );
  }

  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);

  if (end < start) {
    throw new ValidationError(
      'Validation failed',
      ['toDate must be greater than or equal to fromDate'],
      { code: 'ANALYTICS_VALIDATION_ERROR' },
    );
  }

  const rangeDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (rangeDays > config.ANALYTICS_MAX_RANGE_DAYS) {
    throw new ValidationError(
      'Validation failed',
      [`Date range cannot exceed ${config.ANALYTICS_MAX_RANGE_DAYS} days`],
      { code: 'ANALYTICS_VALIDATION_ERROR' },
    );
  }
};

const validate = (schema, input) => {
  const { error, value } = schema.validate(input, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    throw new ValidationError(
      'Validation failed',
      error.details.map((detail) => detail.message),
      { code: 'ANALYTICS_VALIDATION_ERROR' },
    );
  }

  return value;
};

const marketSessionSchema = Joi.object({
  marketId: Joi.string().required(),
  sessionDate: Joi.string().pattern(ISO_DATE).required(),
});

const digitSummarySchema = marketSessionSchema.keys({
  phase: Joi.string().valid(...Object.values(BET_MODE)).required(),
});

const profitLossSchema = Joi.object({
  marketId: Joi.string().trim(),
  sessionDate: Joi.string().pattern(ISO_DATE),
  fromDate: Joi.string().pattern(ISO_DATE),
  toDate: Joi.string().pattern(ISO_DATE),
  sortBy: Joi.string().valid('sessionDate', 'totalCollection', 'totalPayout', 'netProfit').default('sessionDate'),
  ...basePaginationSchema,
});

const bidReportSchema = Joi.object({
  marketId: Joi.string().trim(),
  sessionDate: Joi.string().pattern(ISO_DATE),
  gameType: Joi.string().trim(),
  userId: Joi.string().trim(),
  search: Joi.string().trim().allow(''),
  status: Joi.string().valid(...Object.values(BET_STATUS)),
  sortBy: Joi.string().valid('createdAt', 'betAmount', 'status', 'selection', 'username').default('createdAt'),
  ...basePaginationSchema,
});

const winningHistorySchema = Joi.object({
  marketId: Joi.string().trim(),
  sessionDate: Joi.string().pattern(ISO_DATE),
  gameType: Joi.string().trim(),
  phase: Joi.string().valid(...Object.values(BET_MODE)),
  sortBy: Joi.string().valid('createdAt', 'betAmount', 'recordedPayout', 'username').default('createdAt'),
  ...basePaginationSchema,
});

const depositHistorySchema = Joi.object({
  fromDate: Joi.string().pattern(ISO_DATE),
  toDate: Joi.string().pattern(ISO_DATE),
  status: Joi.string().valid(...Object.values(DEPOSIT_STATUS)),
  provider: Joi.string().valid(...Object.values(DEPOSIT_PROVIDER)),
  userId: Joi.string().trim(),
  ...basePaginationSchema,
  sortBy: Joi.string().valid('createdAt', 'amount', 'updatedAt', 'creditedAt').default('createdAt'),
});

const validateDashboardSummaryQuery = (query) => validate(Joi.object({}).unknown(false), query);

const validateMarketDigitSummaryQuery = ({ params, query }) => {
  const value = validate(digitSummarySchema, { marketId: params.marketId, ...query });
  validateObjectId(value.marketId, 'marketId');
  return value;
};

const validateMarketBidSummaryQuery = ({ params, query }) => {
  const value = validate(marketSessionSchema, { marketId: params.marketId, ...query });
  validateObjectId(value.marketId, 'marketId');
  return value;
};

const validateProfitLossQuery = (query) => {
  const value = validate(profitLossSchema, query);
  validateObjectId(value.marketId, 'marketId');
  validateDateRange(value);
  return value;
};

const validateBidReportQuery = (query) => {
  const value = validate(bidReportSchema, query);
  validateObjectId(value.marketId, 'marketId');
  validateObjectId(value.userId, 'userId');
  return value;
};

const validateWinningHistoryQuery = (query) => {
  const value = validate(winningHistorySchema, query);
  validateObjectId(value.marketId, 'marketId');

  if (!value.sessionDate && !value.marketId) {
    throw new ValidationError(
      'Validation failed',
      ['At least one of sessionDate or marketId is required for production performance'],
      { code: 'ANALYTICS_VALIDATION_ERROR' },
    );
  }

  return value;
};

const validateDepositHistoryQuery = (query) => {
  const value = validate(depositHistorySchema, query);
  validateObjectId(value.userId, 'userId');
  validateDateRange(value);
  return value;
};

module.exports = {
  validateDashboardSummaryQuery,
  validateMarketDigitSummaryQuery,
  validateMarketBidSummaryQuery,
  validateProfitLossQuery,
  validateBidReportQuery,
  validateWinningHistoryQuery,
  validateDepositHistoryQuery,
};
