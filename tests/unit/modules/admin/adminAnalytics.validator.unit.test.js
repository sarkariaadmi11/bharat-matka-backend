describe('adminAnalytics.validator', () => {
  let validator;

  beforeEach(() => {
    jest.resetModules();
    validator = require('@modules/admin/analytics/adminAnalytics.validator');
  });

  test('rejects winning history without bounded session filters', () => {
    expect(() => validator.validateWinningHistoryQuery({}))
      .toThrow('Validation failed');
  });

  test('rejects profit loss ranges above configured maximum', () => {
    expect(() => validator.validateProfitLossQuery({
      fromDate: '2026-01-01',
      toDate: '2026-02-10',
    })).toThrow('Validation failed');
  });

  test('accepts deposit history filters with pagination defaults', () => {
    const result = validator.validateDepositHistoryQuery({
      fromDate: '2026-04-01',
      toDate: '2026-04-05',
      status: 'success',
    });

    expect(result).toEqual(expect.objectContaining({
      fromDate: '2026-04-01',
      toDate: '2026-04-05',
      status: 'success',
      page: 1,
      limit: 20,
    }));
  });
});
