const { ValidationError } = require('@utils/errors');
const { getGameTypeRule } = require('@domain/gameRules');

const ensureDigitsArray = (digits) => {
  if (!Array.isArray(digits)) {
    throw new ValidationError('digits must be an array');
  }
};

const validateDigits = (digits) => {
  if (!digits.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9)) {
    throw new ValidationError('digits must be integers in range 0-9');
  }

  if (new Set(digits).size !== digits.length) {
    throw new ValidationError('digits must be unique');
  }
};

const validateMotorPayload = ({ type, digits }) => {
  const rule = getGameTypeRule(type);
  if (!rule) {
    throw new ValidationError('Unsupported motor type');
  }

  ensureDigitsArray(digits);

  if (digits.length > rule.maxDigits) {
    throw new ValidationError(`digits must contain ${rule.maxDigits} or fewer values`);
  }

  if (digits.length < 3) {
    throw new ValidationError('digits must contain at least 3 values');
  }

  validateDigits(digits);

  const generator = rule.generator;
  if (typeof generator !== 'function') {
    throw new ValidationError('Combination generator not configured');
  }

  const combinations = generator(digits);
  if (rule.maxCombinations && combinations.length > rule.maxCombinations) {
    throw new ValidationError('Motor combinations exceed configured limit');
  }

  return combinations;
};

module.exports = {
  validateMotorPayload,
};
