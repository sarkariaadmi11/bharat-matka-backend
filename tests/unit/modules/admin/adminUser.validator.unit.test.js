const { ValidationError } = require('@utils/errors');
const { validateBetEditPayload } = require('@modules/admin/users/adminUser.validator');

describe('adminUser.validator validateBetEditPayload', () => {
  test('preserves object-based bet values', () => {
    const payload = validateBetEditPayload({
      amount: 123,
      value: { digit: '8' },
    });

    expect(payload).toEqual({
      amount: 123,
      value: { digit: '8' },
    });
  });

  test('maps legacy selection field to value', () => {
    const payload = validateBetEditPayload({
      amount: 123,
      selection: '8',
    });

    expect(payload).toEqual({
      amount: 123,
      value: '8',
    });
  });

  test('rejects empty value strings', () => {
    expect(() => validateBetEditPayload({ value: '   ' })).toThrow(ValidationError);
  });
});
