/**
 * Validation Middleware
 * Validates request data before passing to controller
 */

const { validateData } = require('@utils/validator');
const validationRules = require('@utils/validationRules');
const { ValidationError } = require('@utils/errors');
const { RepositoryFactory } = require('@infra/database');
const authRepository = RepositoryFactory.getRepository('Auth');

/**
 * Creates a validation middleware for a specific endpoint
 * @param {string} resource - Resource name (e.g., 'user')
 * @param {string} action - Action name (e.g., 'create', 'update')
 */
const validate = (resource, action) => {
  return async (req, res, next) => {
    const rules = { ...validationRules[resource]?.[action] };

    if (!rules) {
      // If no rules defined, proceed
      return next();
    }

    // Dynamically add unique validation functions for auth.register
    if (resource === 'auth' && action === 'register') {
      if (rules.phone?.unique) {
        rules.phone.isUnique = async (value) => !await authRepository.phoneExists(value);
      }
    }

    const data = {
      ...req.body,
      ...req.params,
      ...req.query,
    };

    const validation = await validateData(data, rules);

    if (!validation.valid) {
      return next(new ValidationError('Validation failed', validation.errors));
    }

    // Attach validated data to request
    req.validatedData = validation.validatedData;
    next();
  };
};

module.exports = {
  validate,
};

