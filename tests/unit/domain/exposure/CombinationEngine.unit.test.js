const { CombinationEngine, MOTOR_TYPE } = require('@domain/combinations');

describe('CombinationEngine motor strategies', () => {
  test('generates normalized C(n,3) panas for SP_MOTOR', () => {
    const result = CombinationEngine.generate({
      type: MOTOR_TYPE.SP_MOTOR,
      digits: [4, 1, 2, 3],
    });

    expect(result).toEqual({
      type: 'SP_MOTOR',
      digits: [1, 2, 3, 4],
      panas: ['123', '124', '134', '234'],
      count: 4,
    });
  });

  test('enforces digit validation and allows up to 10 digits', () => {
    expect(() =>
      CombinationEngine.generate({
        type: MOTOR_TYPE.SP_MOTOR,
        digits: [1, 2],
      })).toThrow('digits must contain 3-10 values');

    expect(() =>
      CombinationEngine.generate({
        type: MOTOR_TYPE.SP_MOTOR,
        digits: [1, 2, 2],
      })).toThrow('digits must be unique');

    expect(() =>
      CombinationEngine.generate({
        type: MOTOR_TYPE.SP_MOTOR,
        digits: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
      })).not.toThrow();
  });

  test('generates double-pana combinations for DP_MOTOR', () => {
    const result = CombinationEngine.generate({
      type: MOTOR_TYPE.DP_MOTOR,
      digits: [1, 2, 3],
    });

    expect(result.panas).toEqual(['112', '113', '122', '133', '223', '233']);
    expect(result.count).toBe(6);
  });

  test('supports full 10-digit SP_MOTOR combination generation', () => {
    const result = CombinationEngine.generate({
      type: MOTOR_TYPE.SP_MOTOR,
      digits: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
    });

    expect(result.count).toBe(120);
  });

  test('normalizes motor digit sets with 0 treated as highest', () => {
    const result = CombinationEngine.generate({
      type: MOTOR_TYPE.SP_MOTOR,
      digits: [0, 1, 2],
    });

    expect(result).toEqual({
      type: 'SP_MOTOR',
      digits: [1, 2, 0],
      panas: ['120'],
      count: 1,
    });
  });
});
