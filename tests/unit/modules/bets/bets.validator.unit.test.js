const {
  validatePlaceBetsPayload,
} = require('@modules/bets/bets.validator');

describe('bets.validator', () => {
  test('normalizes single bet payload into an array', () => {
    const payload = validatePlaceBetsPayload({
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt1',
      bets: {
        value: { digit: '4' },
        amount: 10,
        betMode: 'open',
      },
    });

    expect(payload.bets).toEqual([
      {
        value: { digit: '4' },
        amount: 10,
        betMode: 'open',
      },
    ]);
  });

  test('allows mixed bet modes in one request', () => {
    const payload = validatePlaceBetsPayload({
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt1',
      bets: [
        { value: { digit: '4' }, amount: 10, betMode: 'open' },
        { value: { digit: '5' }, amount: 10, betMode: 'close' },
      ],
    });

    expect(payload.bets).toHaveLength(2);
    expect(payload.bets[1].betMode).toBe('close');
  });
});
