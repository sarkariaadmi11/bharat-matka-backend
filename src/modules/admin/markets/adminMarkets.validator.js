const Joi = require('joi');
const mongoose = require('mongoose');
const { MARKET_STATUS } = require('@config/constants/domain');
const { ValidationError } = require('@utils/errors');
const { WEEKDAY_KEYS } = require('@domain/markets/marketSchedule');

const ACTIVE_INACTIVE_STATUSES = Object.freeze([
  MARKET_STATUS.ACTIVE,
  MARKET_STATUS.INACTIVE,
]);
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const marketCodePattern = /^[A-Z0-9_]+$/;

const scheduleSchema = Joi.object(
  Object.fromEntries(WEEKDAY_KEYS.map((weekday) => [weekday, Joi.boolean()])),
);

const marketGameTypeConfigSchema = Joi.object({
  gameTypeId: Joi.string().trim().required(),
  payoutMultiplier: Joi.number().positive(),
  minBet: Joi.number().positive(),
  maxBet: Joi.number().positive(),
  status: Joi.string().valid(...ACTIVE_INACTIVE_STATUSES).default(MARKET_STATUS.ACTIVE),
});

const createMarketSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(marketCodePattern).required(),
  name: Joi.string().trim().min(2).max(120).required(),
  status: Joi.string().valid(...ACTIVE_INACTIVE_STATUSES).default(MARKET_STATUS.ACTIVE),
  openTime: Joi.string().pattern(timePattern).required(),
  closeTime: Joi.string().pattern(timePattern).required(),
  schedule: scheduleSchema.required(),
  gameTypes: Joi.array().items(marketGameTypeConfigSchema).min(1).required(),
  description: Joi.string().allow('').max(500).default(''),
});

const editMarketSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(marketCodePattern),
  name: Joi.string().trim().min(2).max(120),
  marketName: Joi.string().trim().min(2).max(120),
  openTime: Joi.string().pattern(timePattern),
  closeTime: Joi.string().pattern(timePattern),
  schedule: scheduleSchema.min(1),
  status: Joi.string().valid(...ACTIVE_INACTIVE_STATUSES),
  gameTypes: Joi.array().items(marketGameTypeConfigSchema).min(1),
  description: Joi.string().allow('').max(500),
}).min(1);

const listMarketsQuerySchema = Joi.object({
  status: Joi.string().valid(...ACTIVE_INACTIVE_STATUSES),
});

const validateWithSchema = (schema, payload) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new ValidationError(error.details.map((detail) => detail.message).join(', '));
  }

  return value;
};

const ensureObjectId = (value, label = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError(`Invalid ${label}`);
  }
};

module.exports = {
  ensureObjectId,
  validateCreateMarketPayload: (payload) => validateWithSchema(createMarketSchema, payload),
  validateEditMarketPayload: (payload) => validateWithSchema(editMarketSchema, payload),
  validateListMarketsQuery: (query) => validateWithSchema(listMarketsQuerySchema, query),
};
