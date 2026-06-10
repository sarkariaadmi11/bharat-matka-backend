const PANA_REGEX = /^\d{3}$/;

const normalizeDigitForZeroHighest = (digit) => (Number(digit) === 0 ? 10 : Number(digit));

const compareDigitsWithZeroHighest = (left, right) => (
  normalizeDigitForZeroHighest(left) - normalizeDigitForZeroHighest(right)
);

const sortDigitsWithZeroHighest = (digits = []) => [...digits]
  .map((digit) => Number(digit))
  .sort(compareDigitsWithZeroHighest);

const isPanaString = (value) => PANA_REGEX.test(String(value || ''));

const canonicalizePana = (value) => {
  const raw = String(value || '');
  if (!isPanaString(raw)) {
    return raw;
  }

  return sortDigitsWithZeroHighest(raw.split('').map((digit) => Number(digit))).join('');
};

const countZeros = (value) => String(value || '').split('').filter((digit) => digit === '0').length;

const compareCanonicalPanas = (left, right) => {
  const normalizedLeft = canonicalizePana(left);
  const normalizedRight = canonicalizePana(right);
  const zeroDiff = countZeros(normalizedLeft) - countZeros(normalizedRight);

  if (zeroDiff !== 0) {
    return zeroDiff;
  }

  const leftDigits = normalizedLeft.split('').map((digit) => Number(digit));
  const rightDigits = normalizedRight.split('').map((digit) => Number(digit));

  for (let index = 0; index < 3; index += 1) {
    const diff = compareDigitsWithZeroHighest(leftDigits[index], rightDigits[index]);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
};

const canonicalizePanaSelection = (selection) => {
  const raw = String(selection || '').trim();
  if (!raw.includes('_')) {
    return isPanaString(raw) ? canonicalizePana(raw) : raw;
  }

  return raw
    .split('_')
    .map((part) => (isPanaString(part) ? canonicalizePana(part) : part))
    .join('_');
};

const buildCanonicalPanaOutcomes = () => {
  const outcomes = [];

  for (let i = 0; i <= 9; i += 1) {
    for (let j = i; j <= 9; j += 1) {
      for (let k = j; k <= 9; k += 1) {
        const digits = [i, j, k];
        outcomes.push({
          outcomePana: canonicalizePana(digits.join('')),
          outcomeDigit: digits.reduce((sum, digit) => sum + digit, 0) % 10,
        });
      }
    }
  }

  return outcomes.sort((left, right) => compareCanonicalPanas(left.outcomePana, right.outcomePana));
};

module.exports = {
  PANA_REGEX,
  isPanaString,
  canonicalizePana,
  canonicalizePanaSelection,
  compareDigitsWithZeroHighest,
  compareCanonicalPanas,
  sortDigitsWithZeroHighest,
  buildCanonicalPanaOutcomes,
};
