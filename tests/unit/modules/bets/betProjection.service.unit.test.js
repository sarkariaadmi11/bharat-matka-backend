const {
  expandWinnerPreviewItems,
  parseExpandedBetReference,
} = require('@modules/bets/betProjection.service');

describe('betProjection.service', () => {
  test('parses expanded bet references into stored id and expansion key', () => {
    expect(parseExpandedBetReference('507f1f77bcf86cd799439011_123')).toEqual({
      storedBetId: '507f1f77bcf86cd799439011',
      expansionKey: '123',
      isExpanded: true,
      raw: '507f1f77bcf86cd799439011_123',
    });
  });

  test('expands motor winner preview into only the matching pana row', () => {
    const items = expandWinnerPreviewItems({
      bet: {
        _id: 'bet-motor-1',
        userId: 'user-1',
        selection: '127,136,145',
        generatedPanas: ['127', '136', '145'],
        amount: 3000,
        stakePerCombination: 1000,
        oddsSnapshot: 120,
        gameTypeCodeSnapshot: 'SP_MOTOR',
        gameTypeTemplateKey: 'SP_MOTOR',
        createdAt: new Date('2026-04-24T09:00:00.000Z'),
      },
      market: { code: 'MKT' },
      gameType: { code: 'SP_MOTOR' },
      resultPana: '127',
      betPayoutPaise: 120000,
      user: { username: 'alice' },
      sessionLabel: 'Open',
    });

    expect(items).toHaveLength(1);
    expect(items).toEqual([
      expect.objectContaining({
        id: 'bet-motor-1_127',
        betId: 'bet-motor-1',
        expansionKey: '127',
        isExpanded: true,
        selection: '127',
        betAmount: 10,
        totalAmount: 30,
        payout: 1200,
        totalPayout: 1200,
        motorLineHit: true,
        username: 'alice',
      }),
    ]);
  });
});
