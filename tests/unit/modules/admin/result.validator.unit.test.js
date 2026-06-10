const {
  validateResetOpenPayload,
  validateResetClosePayload,
} = require('@modules/admin/results/result.validator');

describe('admin result reset payload validation', () => {
  test('accepts open reset without a replacement pana', () => {
    expect(validateResetOpenPayload({
      reason: 'Reset incorrect result',
      note: 'Will redeclare after verification',
      expectedResultRevision: 2,
    })).toEqual({
      reason: 'Reset incorrect result',
      note: 'Will redeclare after verification',
      expectedResultRevision: 2,
    });
  });

  test('accepts close reset without a replacement pana', () => {
    expect(validateResetClosePayload({
      reason: 'Reset incorrect close result',
    })).toEqual({
      reason: 'Reset incorrect close result',
    });
  });

  test('still requires a reset reason', () => {
    expect(() => validateResetOpenPayload({})).toThrow('reason is required');
  });
});
