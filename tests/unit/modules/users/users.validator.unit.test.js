const {
  validateDepositHistoryQuery,
  validateWithdrawalHistoryQuery,
} = require('@modules/users/users.validator');

describe('users.validator history queries', () => {
  test('normalizes valid deposit history query', () => {
    const result = validateDepositHistoryQuery({
      page: '2',
      limit: '10',
      status: 'success',
      provider: 'upi_intent',
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
    });

    expect(result).toEqual({
      page: 2,
      limit: 10,
      status: 'success',
      provider: 'upi_intent',
      fromDate: new Date('2026-04-01T00:00:00.000Z'),
      toDate: new Date('2026-04-30T23:59:59.999Z'),
    });
  });

  test('normalizes valid withdrawal history query', () => {
    const result = validateWithdrawalHistoryQuery({
      status: 'pending',
      method: 'bank',
      fromDate: '2026-04-01T10:00:00.000Z',
      toDate: '2026-04-30T10:00:00.000Z',
    });

    expect(result).toEqual({
      page: 1,
      limit: 20,
      status: 'pending',
      method: 'bank',
      fromDate: new Date('2026-04-01T10:00:00.000Z'),
      toDate: new Date('2026-04-30T10:00:00.000Z'),
    });
  });

  test('rejects invalid page', () => {
    expect(() => validateDepositHistoryQuery({ page: '0' })).toThrow('page must be a positive integer');
  });

  test('rejects invalid limit', () => {
    expect(() => validateDepositHistoryQuery({ limit: '101' })).toThrow('limit must be less than or equal to 100');
  });

  test('rejects invalid deposit status', () => {
    expect(() => validateDepositHistoryQuery({ status: 'done' })).toThrow('Invalid status');
  });

  test('rejects invalid deposit provider', () => {
    expect(() => validateDepositHistoryQuery({ provider: 'manual_withdrawal' })).toThrow('Invalid provider');
  });

  test('rejects invalid withdrawal status', () => {
    expect(() => validateWithdrawalHistoryQuery({ status: 'manual_review' })).toThrow('Invalid status');
  });

  test('rejects invalid withdrawal method', () => {
    expect(() => validateWithdrawalHistoryQuery({ method: 'wallet' })).toThrow('Invalid method');
  });

  test('rejects invalid fromDate', () => {
    expect(() => validateDepositHistoryQuery({ fromDate: 'bad-date' })).toThrow('fromDate must be a valid date');
  });

  test('rejects invalid toDate', () => {
    expect(() => validateDepositHistoryQuery({ toDate: 'bad-date' })).toThrow('toDate must be a valid date');
  });

  test('rejects inverted date range', () => {
    expect(() => validateDepositHistoryQuery({
      fromDate: '2026-05-01',
      toDate: '2026-04-01',
    })).toThrow('fromDate must be less than or equal to toDate');
  });

  test('rejects unknown query params', () => {
    expect(() => validateWithdrawalHistoryQuery({ foo: 'bar' })).toThrow('Unsupported query parameter: foo');
  });
});
