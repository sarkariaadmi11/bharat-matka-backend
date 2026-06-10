const { validateGeneratePayload } = require('@modules/motor/motor.validator');

describe('motor.validator', () => {
  test('accepts valid SP_MOTOR payload', () => {
    expect(() => validateGeneratePayload({ type: 'SP_MOTOR', digits: [1, 2, 3] })).not.toThrow();
  });

  test('accepts valid DP_MOTOR payload', () => {
    expect(() => validateGeneratePayload({ type: 'DP_MOTOR', digits: [1, 2, 3] })).not.toThrow();
  });

  test('rejects invalid digit payloads', () => {
    expect(() => validateGeneratePayload({ type: 'SP_MOTOR', digits: [1, 2] })).toThrow();
    expect(() => validateGeneratePayload({ type: 'SP_MOTOR', digits: [1, 2, 2] })).toThrow('digits must be unique');
    expect(() => validateGeneratePayload({ type: 'SP_MOTOR', digits: [1, 2, 10] })).toThrow('digits must be integers in range 0-9');
  });
});
