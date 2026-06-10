const { ValidationError } = require('@utils/errors');
const {
  canonicalizePana,
  sortDigitsWithZeroHighest,
} = require('@utils/panaCanonicalization');

const isDigits = (value, length) => {
  if (typeof value !== 'string') {
    return false;
  }
  if (!/^\d+$/.test(value)) {
    return false;
  }
  if (length && value.length !== length) {
    return false;
  }
  return true;
};

const getPanaKind = (value) => {
  const unique = new Set(value.split('')).size;
  if (unique === 1) {
    return 'triple';
  }
  if (unique === 2) {
    return 'double';
  }
  if (unique === 3) {
    return 'single';
  }
  return 'unknown';
};

const isValidPana = (value, kind = 'any') => {
  if (!isDigits(value, 3)) {
    return false;
  }
  if (kind === 'any') {
    return true;
  }
  return getPanaKind(value) === kind;
};

const isValidDigitSet = (value, minItems = 3, maxItems = 7) => {
  if (!Array.isArray(value)) {
    return false;
  }

  if (value.length < minItems || (maxItems !== undefined && value.length > maxItems)) {
    return false;
  }

  if (!value.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9)) {
    return false;
  }

  return new Set(value).size === value.length;
};

const isValidPanaSet = (value, minItems = 1, maxItems, kind = 'any') => {
  if (!Array.isArray(value)) {
    return false;
  }

  if (value.length < minItems || (maxItems !== undefined && value.length > maxItems)) {
    return false;
  }

  const normalized = value.map((item) => String(item || ''));
  if (!normalized.every((item) => isValidPana(item, kind) && canonicalizePana(item) === item)) {
    return false;
  }

  return new Set(normalized).size === normalized.length;
};

const ensureRules = (rules) => {
  if (!rules || !Array.isArray(rules.parts) || rules.parts.length === 0) {
    throw new ValidationError('GameType rules are not configured for validation');
  }
};

const normalizeSinglePartObjectAlias = (value, rules = null) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  if (!rules || !Array.isArray(rules.parts) || rules.parts.length !== 1) {
    return value;
  }

  const [part] = rules.parts;
  if (Object.prototype.hasOwnProperty.call(value, part.name)) {
    return value;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'selection')) {
    return { [part.name]: value.selection };
  }

  if (Object.prototype.hasOwnProperty.call(value, 'value')) {
    return { [part.name]: value.value };
  }

  return value;
};

const normalizeValueInput = (value, rules = null) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return normalizeSinglePartObjectAlias(value, rules);
  }

  if (rules && Array.isArray(rules.parts) && rules.parts.length === 1) {
    const [part] = rules.parts;

    if ((part.type === 'digit' || part.type === 'pana') && (typeof value === 'string' || typeof value === 'number')) {
      return { [part.name]: String(value).trim() };
    }

    if ((part.type === 'digit_set' || part.type === 'pana_set') && Array.isArray(value)) {
      return { [part.name]: value };
    }
  }

  throw new ValidationError('Bet value must be an object');
};

const validateBetValue = (value, rules) => {
  ensureRules(rules);
  const normalized = normalizeValueInput(value, rules);

  for (const part of rules.parts) {
    const fieldValue = normalized[part.name];
    if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
      throw new ValidationError(`Missing required part: ${part.name}`);
    }

    if (part.type === 'digit') {
      if (typeof fieldValue !== 'string') {
        throw new ValidationError(`Part ${part.name} must be a string`);
      }
      if (!isDigits(fieldValue, part.length)) {
        throw new ValidationError(`Part ${part.name} must be ${part.length} digit(s)`);
      }
      continue;
    }

    if (part.type === 'pana') {
      if (typeof fieldValue !== 'string') {
        throw new ValidationError(`Part ${part.name} must be a string`);
      }
      if (!isValidPana(fieldValue, part.panaKind || 'any')) {
        throw new ValidationError(`Part ${part.name} must be a valid ${part.panaKind || 'any'} pana`);
      }
      continue;
    }

    if (part.type === 'digit_set') {
      if (!isValidDigitSet(fieldValue, part.minItems || 3, part.maxItems)) {
        throw new ValidationError(`Part ${part.name} must contain unique digits (${part.minItems || 3}-${part.maxItems ?? 'any'})`);
      }
      continue;
    }

    if (part.type === 'pana_set') {
      if (!isValidPanaSet(fieldValue, part.minItems || 1, part.maxItems, part.panaKind || 'any')) {
        throw new ValidationError(`Part ${part.name} must contain unique ${part.panaKind || 'any'} panas (${part.minItems || 1}-${part.maxItems ?? 'any'})`);
      }
      continue;
    }

    throw new ValidationError(`Unsupported part type: ${part.type}`);
  }

  return true;
};

const normalizeBetValueToSelection = (value, rules) => {
  ensureRules(rules);
  const normalized = normalizeValueInput(value, rules);
  const separator = rules.separator || '_';

  const values = rules.parts.map((part) => {
    const fieldValue = normalized[part.name];
    if (part.type === 'pana') {
      return canonicalizePana(fieldValue);
    }
    if (part.type === 'digit_set') {
      return sortDigitsWithZeroHighest(fieldValue).join(',');
    }
    if (part.type === 'pana_set') {
      const arr = Array.isArray(fieldValue)
        ? fieldValue
        : String(fieldValue || '').split(',').map((s) => s.trim()).filter(Boolean);
      return arr.map((item) => String(item || '')).join(',');
    }
    return fieldValue;
  });
  if (values.some((v) => v === undefined || v === null || v === '')) {
    throw new ValidationError('Bet value is missing required parts');
  }

  return values.join(separator);
};

module.exports = {
  validateBetValue,
  normalizeBetValueToSelection,
};
