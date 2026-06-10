const { normalizeBetValueToSelection } = require('@utils/betValueValidator');

describe('betValueValidator', () => {
  test('normalizes digit_set selections with 0 treated as highest', () => {
    const selection = normalizeBetValueToSelection(
      { digits: [3, 0, 2, 1] },
      {
        separator: ',',
        parts: [{ name: 'digits', type: 'digit_set', minItems: 3, maxItems: 7 }],
      },
    );

    expect(selection).toBe('1,2,3,0');
  });

  test('normalizes pana selections with 0 treated as highest', () => {
    const selection = normalizeBetValueToSelection(
      { pana: '012' },
      {
        separator: '_',
        parts: [{ name: 'pana', type: 'pana', length: 3, panaKind: 'any' }],
      },
    );

    expect(selection).toBe('120');
  });

  test('preserves pana_set ordering when values are already canonical', () => {
    const selection = normalizeBetValueToSelection(
      { panas: ['128', '230', '120'] },
      {
        separator: ',',
        parts: [{ name: 'panas', type: 'pana_set', minItems: 1, panaKind: 'single' }],
      },
    );

    expect(selection).toBe('128,230,120');
  });

  test('accepts scalar values for single-part digit rules', () => {
    const selection = normalizeBetValueToSelection(
      '8',
      {
        separator: '_',
        parts: [{ name: 'digit', type: 'digit', length: 1 }],
      },
    );

    expect(selection).toBe('8');
  });

  test('accepts selection alias object for single-part digit rules', () => {
    const selection = normalizeBetValueToSelection(
      { selection: '8' },
      {
        separator: '_',
        parts: [{ name: 'digit', type: 'digit', length: 1 }],
      },
    );

    expect(selection).toBe('8');
  });

  test('accepts selection alias object for single-part pana rules', () => {
    const selection = normalizeBetValueToSelection(
      { selection: '012' },
      {
        separator: '_',
        parts: [{ name: 'pana', type: 'pana', length: 3, panaKind: 'any' }],
      },
    );

    expect(selection).toBe('120');
  });

  test('accepts selection alias object for single-part pana_set rules', () => {
    const selection = normalizeBetValueToSelection(
      { selection: ['128', '230'] },
      {
        separator: ',',
        parts: [{ name: 'panas', type: 'pana_set', minItems: 1, panaKind: 'single' }],
      },
    );

    expect(selection).toBe('128,230');
  });
});
