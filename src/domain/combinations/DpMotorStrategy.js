const {
  compareCanonicalPanas,
  sortDigitsWithZeroHighest,
} = require('@utils/panaCanonicalization');

class DpMotorStrategy {
  static generate({ digits = [] }) {
    const normalizedDigits = sortDigitsWithZeroHighest(digits);
    const panas = [];

    // Why: DP motor requires exactly one repeated digit and one distinct digit,
    // while preserving canonical pana ordering for settlement/exposure keys.
    for (let i = 0; i < normalizedDigits.length; i += 1) {
      for (let j = 0; j < normalizedDigits.length; j += 1) {
        if (i === j) {
          continue;
        }
        const repeated = normalizedDigits[i];
        const single = normalizedDigits[j];
        const sorted = sortDigitsWithZeroHighest([repeated, repeated, single]);
        panas.push(sorted.join(''));
      }
    }

    return [...new Set(panas)].sort(compareCanonicalPanas);
  }
}

module.exports = DpMotorStrategy;
