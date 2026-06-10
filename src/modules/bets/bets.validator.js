const Joi = require('joi');
const { BET_MODE } = require('@config/constants/domain');
const { ValidationError } = require('@utils/errors');
const { BettingRuleEngine } = require('@domain/rule-engine');

const bettingRuleEngine = new BettingRuleEngine();

const betItemSchema = Joi.object({
  value: Joi.object().required(),
  amount: Joi.number().positive().required(),
  betMode: Joi.string().valid(...Object.values(BET_MODE)).required(),
});

const placeBetsSchema = Joi.object({
  userId: Joi.alternatives().try(
    Joi.string().trim(),
    Joi.object(),
  ).required().messages({
    'any.required': 'userId is required',
  }),
  sessionId: Joi.string().trim().required().messages({
    'string.empty': 'sessionId is required',
    'any.required': 'sessionId is required',
  }),
  gameTypeId: Joi.string().trim().required().messages({
    'string.empty': 'gameTypeId is required',
    'any.required': 'gameTypeId is required',
  }),
  bets: Joi.alternatives().try(
    betItemSchema,
    Joi.array().items(betItemSchema).min(1),
  ).required().messages({
    'any.required': 'bets is required',
  }),
});

const historyQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  market: Joi.string().trim(),
  gameType: Joi.string().trim(),
});

const validateSchema = (schema, payload) => {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    throw new ValidationError(error.details.map((detail) => detail.message).join(', '));
  }

  return value;
};

const normalizeBets = (bets) => (Array.isArray(bets) ? bets : [bets]);

const ensureNonEmptyString = (value, fieldName) => {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} is required`);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    throw new ValidationError(`${fieldName} is invalid`);
  }

  return normalized;
};

const validatePlaceBetsPayload = (payload = {}) => {
  const validated = validateSchema(placeBetsSchema, payload);
  const userId = ensureNonEmptyString(validated.userId, 'userId');
  const sessionId = ensureNonEmptyString(validated.sessionId, 'sessionId');
  const gameTypeId = ensureNonEmptyString(validated.gameTypeId, 'gameTypeId');

  const bets = normalizeBets(validated.bets);

  return {
    userId,
    sessionId,
    gameTypeId,
    bets,
  };
};

const validateBetsAgainstContext = ({ bets = [], gameType, session }) => {
  for (const bet of bets) {
    bettingRuleEngine.validateBet({
      bet,
      gameType,
      session,
    });
  }
};

const validateGetMyBetsQuery = (query = {}) => validateSchema(historyQuerySchema, query);

module.exports = {
  validatePlaceBetsPayload,
  validateBetsAgainstContext,
  validateGetMyBetsQuery,
};
