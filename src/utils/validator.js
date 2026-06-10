/**
 * Validator Utility
 * Handles all validation logic for request data
 */

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidType = (value, type) => {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'email':
      return typeof value === 'string' && isValidEmail(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
};

const validateField = async (fieldName, value, rule, data) => {
  // Check if required and missing
  if (rule.required && (value === undefined || value === null || value === '')) {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }

  // If not required and not provided, skip validation
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return { valid: true };
  }

  // Type validation
  if (!isValidType(value, rule.type)) {
    return {
      valid: false,
      error: `${fieldName} must be of type ${rule.type}`,
    };
  }

  // String length validation
  if (rule.type === 'string') {
    if (rule.min && value.length < rule.min) {
      return {
        valid: false,
        error: `${fieldName} must be at least ${rule.min} characters long`,
      };
    }
    if (rule.max && value.length > rule.max) {
      return {
        valid: false,
        error: `${fieldName} must not exceed ${rule.max} characters`,
      };
    }
  }

  // Number range validation
  if (rule.type === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return {
        valid: false,
        error: `${fieldName} must be at least ${rule.min}`,
      };
    }
    if (rule.max !== undefined && value > rule.max) {
      return {
        valid: false,
        error: `${fieldName} must not exceed ${rule.max}`,
      };
    }
  }

  // Enum validation
  if (rule.enum && !rule.enum.includes(value)) {
    return {
      valid: false,
      error: `${fieldName} must be one of: ${rule.enum.join(', ')}`,
    };
  }

  // Pattern validation (regex)
  if (rule.pattern && !rule.pattern.test(value)) {
    return {
      valid: false,
      error: `${fieldName} format is invalid`,
    };
  }

  // Matches validation (e.g., confirmPassword === password)
  if (rule.matches && data && value !== data[rule.matches]) {
    return {
      valid: false,
      error: `${fieldName} must match ${rule.matches}`,
    };
  }

  // Unique validation (should be handled in service layer, but exposed here for middleware)
  if (rule.unique && rule.isUnique && !(await rule.isUnique(value))) {
    return {
      valid: false,
      error: `${fieldName} already exists`,
    };
  }

  return { valid: true };
};

const validateData = async (data, rules) => {
  const errors = [];
  const validatedData = {};

  // Check all defined rules
  for (const [fieldName, rule] of Object.entries(rules)) {
    const value = data[fieldName];
    const validation = await validateField(fieldName, value, rule, data);

    if (!validation.valid) {
      errors.push(validation.error);
    } else if (value !== undefined) {
      // Only add to validatedData if it's a valid field and not undefined
      validatedData[fieldName] = value;
    }
  }

  // Check for extra fields (not in rules)
  for (const key of Object.keys(data)) {
    if (!(key in rules)) {
      errors.push(`${key} is not a valid field`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validatedData,
  };
};

module.exports = {
  validateData,
  validateField,
  isValidEmail,
  isValidType,
};
