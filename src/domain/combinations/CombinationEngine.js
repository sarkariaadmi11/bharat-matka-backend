const SpMotorStrategy = require('./SpMotorStrategy');
const DpMotorStrategy = require('./DpMotorStrategy');
const { ValidationError } = require('@utils/errors');
const { getGameTypeRule } = require('@domain/gameRules');
const { sortDigitsWithZeroHighest } = require('@utils/panaCanonicalization');

const MOTOR_TYPE = Object.freeze({
  SP_MOTOR: 'SP_MOTOR',
  DP_MOTOR: 'DP_MOTOR',
});

const LIMITS = Object.freeze({
  MIN_DIGITS: 3,
  MAX_DIGITS: 10,
});

const normalizeDigits = (digits, rule) => {
  if (!Array.isArray(digits)) {
    throw new ValidationError('digits must be an array');
  }

  const minDigits = LIMITS.MIN_DIGITS;
  const maxDigits = rule?.maxDigits || LIMITS.MAX_DIGITS;

  if (digits.length < minDigits || digits.length > maxDigits) {
    throw new ValidationError(`digits must contain ${minDigits}-${maxDigits} values`);
  }

  const normalized = digits.map((digit) => {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      throw new ValidationError('digits must be integers in range 0-9');
    }
    return digit;
  });

  if (new Set(normalized).size !== normalized.length) {
    throw new ValidationError('digits must be unique');
  }

  return sortDigitsWithZeroHighest(normalized);
};

const parseSelectionDigits = (selection) => {
  const raw = String(selection || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (!raw.length) {
    return [];
  }

  return raw.map((token) => Number(token));
};

const resolveDigits = ({ digits, selection, rule }) => {
  if (Array.isArray(digits) && digits.length > 0) {
    return normalizeDigits(digits, rule);
  }

  return normalizeDigits(parseSelectionDigits(selection), rule);
};

const MAX_MOTOR_COMBINATIONS = 35;

class CombinationEngine {
  static strategyMap = new Map([
    [MOTOR_TYPE.SP_MOTOR, SpMotorStrategy],
    [MOTOR_TYPE.DP_MOTOR, DpMotorStrategy],
  ]);

  static registerStrategy(type, StrategyClass) {
    this.strategyMap.set(type, StrategyClass);
  }

  static generate({ type, digits, selection }) {
    const Strategy = this.strategyMap.get(type);
    if (!Strategy || typeof Strategy.generate !== 'function') {
      throw new ValidationError('Unsupported motor type');
    }

    const rule = getGameTypeRule(type);
    const resolvedDigits = resolveDigits({ digits, selection, rule });

    // Why: generation remains pure and deterministic so both exposure and settlement
    // can rely on the same canonical pana set.
    const panas = Strategy.generate({ digits: resolvedDigits });
    if (rule?.maxCombinations && panas.length > Number(rule.maxCombinations)) {
      throw new ValidationError('Motor combinations exceed configured limit');
    }

    return {
      type,
      digits: resolvedDigits,
      panas,
      count: panas.length,
    };
  }
}

module.exports = {
  CombinationEngine,
  MOTOR_TYPE,
  LIMITS,
  MAX_MOTOR_COMBINATIONS,
};
