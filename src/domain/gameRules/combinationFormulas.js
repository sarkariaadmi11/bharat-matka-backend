const {
  compareCanonicalPanas,
  sortDigitsWithZeroHighest,
} = require('@utils/panaCanonicalization');

const normalizeDigits = (digits = []) => sortDigitsWithZeroHighest(digits);

const spMotorCombinations = (digits = []) => {
  const normalized = normalizeDigits(digits);
  const panas = [];

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      for (let k = j + 1; k < normalized.length; k += 1) {
        panas.push(`${normalized[i]}${normalized[j]}${normalized[k]}`);
      }
    }
  }

  return panas.sort(compareCanonicalPanas);
};

const dpMotorCombinations = (digits = []) => {
  const normalized = normalizeDigits(digits);
  const panas = [];

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = 0; j < normalized.length; j += 1) {
      if (i === j) {
        continue;
      }
      const repeated = normalized[i];
      const single = normalized[j];
      const sorted = sortDigitsWithZeroHighest([repeated, repeated, single]);
      panas.push(sorted.join(''));
    }
  }

  return [...new Set(panas)].sort(compareCanonicalPanas);
};

module.exports = {
  spMotorCombinations,
  dpMotorCombinations,
};
