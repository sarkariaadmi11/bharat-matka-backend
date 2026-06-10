describe('adminSettings.validator', () => {
  let validator;

  beforeEach(() => {
    jest.resetModules();
    validator = require('@modules/admin/settings/adminSettings.validator');
  });

  test('normalizes support contact fields', () => {
    const result = validator.validateSupportContactPayload({
      whatsappNumber: ' 9876543210 ',
      telegramLink: ' @support_handle ',
      supportEmail: ' Support@Example.COM ',
    });

    expect(result).toEqual({
      whatsappNumber: '9876543210',
      telegramLink: '@support_handle',
      supportEmail: 'support@example.com',
    });
  });

  test('allows clearing support email', () => {
    const result = validator.validateSupportContactPayload({
      supportEmail: '',
    });

    expect(result).toEqual({
      whatsappNumber: undefined,
      telegramLink: undefined,
      supportEmail: null,
    });
  });

  test('rejects invalid support email', () => {
    expect(() => validator.validateSupportContactPayload({
      supportEmail: 'support-email',
    })).toThrow('Invalid support contact settings');
  });

  describe('validateSettingsPayload', () => {
    test('throws when payload is empty', () => {
      expect(() => validator.validateSettingsPayload({})).toThrow('At least one field must be provided');
    });

    test('validates amount fields >= 0', () => {
      expect(() => validator.validateSettingsPayload({ minimumDeposit: -1 })).toThrow('Invalid settings');
      expect(() => validator.validateSettingsPayload({ minimumDeposit: 'abc' })).toThrow('Invalid settings');
    });

    test('validates minimum <= maximum for deposits', () => {
      expect(() => validator.validateSettingsPayload({
        minimumDeposit: 1000,
        maximumDeposit: 500,
      })).toThrow('Invalid settings');
    });

    test('validates minimum <= maximum for withdrawals', () => {
      expect(() => validator.validateSettingsPayload({
        minimumWithdrawal: 1000,
        maximumWithdrawal: 500,
      })).toThrow('Invalid settings');
    });

    test('validates minimum <= maximum for bids', () => {
      expect(() => validator.validateSettingsPayload({
        minimumBidAmount: 1000,
        maximumBidAmount: 500,
      })).toThrow('Invalid settings');
    });

    test('validates time format HH:mm', () => {
      expect(() => validator.validateSettingsPayload({ withdrawOpenTime: '25:00' })).toThrow('Invalid settings');
      expect(() => validator.validateSettingsPayload({ withdrawOpenTime: '09:61' })).toThrow('Invalid settings');
      expect(() => validator.validateSettingsPayload({ withdrawOpenTime: '9:00' })).toThrow('Invalid settings');
    });

    test('validates globalBetting must be boolean', () => {
      expect(() => validator.validateSettingsPayload({ globalBetting: 'yes' })).toThrow('Invalid settings');
      expect(() => validator.validateSettingsPayload({ globalBetting: 1 })).toThrow('Invalid settings');
    });

    test('validates resultDeclarationGraceHours integer 0-23', () => {
      expect(() => validator.validateSettingsPayload({ resultDeclarationGraceHours: 24 })).toThrow('Invalid settings');
      expect(() => validator.validateSettingsPayload({ resultDeclarationGraceHours: -1 })).toThrow('Invalid settings');
      expect(() => validator.validateSettingsPayload({ resultDeclarationGraceHours: 1.5 })).toThrow('Invalid settings');
    });

    test('returns valid payload with correct values', () => {
      const result = validator.validateSettingsPayload({
        minimumDeposit: 201,
        maximumDeposit: 100000,
        minimumWithdrawal: 1000,
        maximumWithdrawal: 100000,
        withdrawOpenTime: '09:00',
        withdrawCloseTime: '13:00',
        globalBetting: true,
      });

      expect(result).toEqual({
        minimumDeposit: 201,
        maximumDeposit: 100000,
        minimumWithdrawal: 1000,
        maximumWithdrawal: 100000,
        withdrawOpenTime: '09:00',
        withdrawCloseTime: '13:00',
        globalBetting: true,
      });
    });

    test('converts amount string values to numbers', () => {
      const result = validator.validateSettingsPayload({ minimumDeposit: '100' });
      expect(result).toEqual({ minimumDeposit: 100 });
    });
  });
});
