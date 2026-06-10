const Joi = require('joi');
const { ValidationError } = require('@utils/errors');

const phoneRule = Joi.string().pattern(/^\d{10}$/).required().messages({
  'string.empty': 'phone is required',
  'string.pattern.base': 'phone must be 10 digits',
});

const passwordRule = Joi.string().min(6).required().messages({
  'string.empty': 'password is required',
  'string.min': 'password must be at least 6 characters long',
});

const registerSchema = Joi.object({
  username: Joi.string().trim().min(3).max(30).required().messages({
    'string.empty': 'username is required',
    'string.min': 'username must be at least 3 characters long',
    'string.max': 'username must be at most 30 characters long',
  }),
  phone: phoneRule,
  password: passwordRule,
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'confirmPassword must match password',
      'string.empty': 'confirmPassword is required',
    }),
});

const loginSchema = Joi.object({
  phone: phoneRule,
  password: passwordRule,
});

const changePasswordSchema = Joi.object({
  currentPassword: passwordRule.messages({
    'string.empty': 'currentPassword is required',
    'string.min': 'currentPassword must be at least 6 characters long',
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.empty': 'newPassword is required',
    'string.min': 'newPassword must be at least 6 characters long',
  }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'confirmPassword must match newPassword',
      'string.empty': 'confirmPassword is required',
    }),
});

const forgotPasswordSchema = Joi.object({
  phone: phoneRule,
});

const resetPasswordSchema = Joi.object({
  resetToken: Joi.string().trim().required().messages({
    'string.empty': 'resetToken is required',
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.empty': 'newPassword is required',
    'string.min': 'newPassword must be at least 6 characters long',
  }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'confirmPassword must match newPassword',
      'string.empty': 'confirmPassword is required',
    }),
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().trim().required().messages({
    'string.empty': 'refreshToken is required',
  }),
});

const validateSchema = async (schema, payload) => {
  try {
    return await schema.validateAsync(payload, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    throw new ValidationError(
      'Validation failed',
      error.details.map((detail) => detail.message),
    );
  }
};

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  validateRegister: (payload) => validateSchema(registerSchema, payload),
  validateLogin: (payload) => validateSchema(loginSchema, payload),
  validateChangePassword: (payload) => validateSchema(changePasswordSchema, payload),
  validateForgotPassword: (payload) => validateSchema(forgotPasswordSchema, payload),
  validateResetPassword: (payload) => validateSchema(resetPasswordSchema, payload),
  validateRefreshToken: (payload) => validateSchema(refreshTokenSchema, payload),
};
