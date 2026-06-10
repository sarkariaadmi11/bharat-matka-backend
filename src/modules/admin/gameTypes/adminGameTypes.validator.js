const Joi = require('joi');
const mongoose = require('mongoose');
const { MARKET_STATUS } = require('@config/constants/domain');
const { ValidationError } = require('@utils/errors');
const { GameTypeRegistry } = require('@domain/rule-engine/GameTypeRegistry');

const ACTIVE_INACTIVE_STATUSES = Object.freeze([
  MARKET_STATUS.ACTIVE,
  MARKET_STATUS.INACTIVE,
]);
const gameTypeCodePattern = /^[A-Z0-9_]+$/;

const createGameTypeSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(gameTypeCodePattern).required(),
  name: Joi.string().trim().min(2).max(120).required(),
  templateKey: Joi.string().valid(...GameTypeRegistry.templateKeys()).required(),
  payoutMultiplier: Joi.number().positive().required(),
  minBet: Joi.number().integer().min(1).default(1),
  maxBet: Joi.number().integer().min(1).default(100000),
  status: Joi.string().valid(...ACTIVE_INACTIVE_STATUSES).default(MARKET_STATUS.ACTIVE),
});

const updateGameTypeSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(gameTypeCodePattern),
  name: Joi.string().trim().min(2).max(120),
  templateKey: Joi.string().valid(...GameTypeRegistry.templateKeys()),
  payoutMultiplier: Joi.number().positive(),
  minBet: Joi.number().integer().min(1),
  maxBet: Joi.number().integer().min(1),
  status: Joi.string().valid(...ACTIVE_INACTIVE_STATUSES),
  enabled: Joi.boolean(),
}).min(1);

const listGameTypesQuerySchema = Joi.object({
  status: Joi.string().valid(...ACTIVE_INACTIVE_STATUSES),
});

const ensureObjectId = (value, label = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError(`Invalid ${label}`);
  }
};

const validateWithSchema = (schema, payload) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new ValidationError(error.details.map((detail) => detail.message).join(', '));
  }

  if (
    typeof value.minBet === 'number'
    && typeof value.maxBet === 'number'
    && value.minBet > value.maxBet
  ) {
    throw new ValidationError('minBet must be less than or equal to maxBet');
  }

  return value;
};

module.exports = {
  ensureObjectId,
  validateCreateGameTypePayload: (payload) => validateWithSchema(createGameTypeSchema, payload),
  validateUpdateGameTypePayload: (payload) => validateWithSchema(updateGameTypeSchema, payload),
  validateListGameTypesQuery: (query) => validateWithSchema(listGameTypesQuerySchema, query),
};
