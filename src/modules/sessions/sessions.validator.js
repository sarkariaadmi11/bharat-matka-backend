const Joi = require('joi');
const { ValidationError } = require('@utils/errors');

const cancelSessionSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(300).required(),
  idempotencyKey: Joi.string().trim().min(3).max(200).required(),
  force: Joi.boolean().default(false),
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

module.exports = {
  validateCancelSessionPayload: (payload) => validateSchema(cancelSessionSchema, payload),
};
