const {
  buildCanonicalPanaOutcomes,
  canonicalizePana,
  compareCanonicalPanas,
  sortDigitsWithZeroHighest,
} = require('@utils/panaCanonicalization');

describe('panaCanonicalization', () => {
  test('canonicalizes panas with 0 treated as highest', () => {
    expect(canonicalizePana('012')).toBe('120');
    expect(canonicalizePana('505')).toBe('550');
    expect(canonicalizePana('000')).toBe('000');
  });

  test('sorts digit sets with 0 treated as highest', () => {
    expect(sortDigitsWithZeroHighest([0, 3, 1, 2])).toEqual([1, 2, 3, 0]);
  });

  test('sorts canonical panas with zero-containing outcomes last', () => {
    const panas = ['120', '123', '340', '234', '130'];

    expect(panas.sort(compareCanonicalPanas)).toEqual(['123', '234', '120', '130', '340']);
  });

  test('builds canonical outcome space using zero-highest format', () => {
    const outcomes = buildCanonicalPanaOutcomes();

    expect(outcomes).toHaveLength(220);
    expect(outcomes.some((item) => item.outcomePana === '120' && item.outcomeDigit === 3)).toBe(true);
    expect(outcomes.some((item) => item.outcomePana === '012')).toBe(false);
  });
});
