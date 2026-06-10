const {
  compareCanonicalPanas,
  sortDigitsWithZeroHighest,
} = require('@utils/panaCanonicalization');

class SpMotorStrategy {
  static generate({ digits = [] }) {
    const normalizedDigits = sortDigitsWithZeroHighest(digits);

    const panas = [];

    // Why: SP motor generates canonical single-pana combinations (C(n,3)),
    // not permutations, so settlement and exposure share stable pana keys.
    for (let i = 0; i < normalizedDigits.length; i += 1) {
      for (let j = i + 1; j < normalizedDigits.length; j += 1) {
        for (let k = j + 1; k < normalizedDigits.length; k += 1) {
          panas.push(`${normalizedDigits[i]}${normalizedDigits[j]}${normalizedDigits[k]}`);
        }
      }
    }

    return panas.sort(compareCanonicalPanas);
  }
}

module.exports = SpMotorStrategy;
