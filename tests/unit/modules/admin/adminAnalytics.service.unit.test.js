describe('adminAnalytics.service', () => {
  let service;
  let mocks;

  beforeEach(() => {
    jest.resetModules();

    mocks = {
      adminAnalyticsRepository: {
        getDashboardSummary: jest.fn(),
        getMarketDigitSummary: jest.fn(),
      },
      gameSessionRepository: {
        findByMarketAndDateLean: jest.fn(),
        findSessionIdsByDateRange: jest.fn(),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            AdminAnalytics: mocks.adminAnalyticsRepository,
            GameSession: mocks.gameSessionRepository,
          };
          return repoMap[name];
        },
      },
    }));

    jest.doMock('@utils/logger', () => ({
      debug: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    }));

    service = require('@modules/admin/analytics/adminAnalytics.service');
  });

  test('zero-fills market digits 0-9', async () => {
    mocks.gameSessionRepository.findByMarketAndDateLean.mockResolvedValue({
      _id: 'session-1',
      sessionDate: new Date('2026-04-24T00:00:00.000Z'),
      marketId: 'market-1',
      currentResult: { openDigit: 5 },
      settledResult: { openDigit: 5 },
      isFinanciallyConsistent: true,
      warning: null,
      settlementStatus: 'completed',
    });
    mocks.adminAnalyticsRepository.getMarketDigitSummary.mockResolvedValue([
      { digit: '5', totalBets: 3, totalAmount: 1500, totalPlayers: 2 },
    ]);

    const result = await service.getMarketDigitSummary({
      marketId: 'market-1',
      sessionDate: '2026-04-24',
      phase: 'open',
    });

    expect(result.data.items).toHaveLength(10);
    expect(result.data.items[5]).toEqual({
      digit: '5',
      totalBets: 3,
      totalAmount: 15,
      totalPlayers: 2,
    });
    expect(result.data.items[0]).toEqual({
      digit: '0',
      totalBets: 0,
      totalAmount: 0,
      totalPlayers: 0,
    });
  });

  test('returns dashboard cache hit metadata on repeated requests', async () => {
    mocks.adminAnalyticsRepository.getDashboardSummary.mockResolvedValue({
      users: { total: 10, approved: 7, unapproved: 3 },
      markets: { total: 2 },
      sessions: { today: 4 },
      finance: { totalBidAmount: 10000, totalWinningAmount: 3500 },
    });

    const first = await service.getDashboardSummary({ businessDate: '2026-04-24' });
    const second = await service.getDashboardSummary({ businessDate: '2026-04-24' });

    expect(first.meta.cache).toEqual({ hit: false, ttlSeconds: 15 });
    expect(second.meta.cache).toEqual({ hit: true, ttlSeconds: 15 });
    expect(mocks.adminAnalyticsRepository.getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(second.data.finance).toEqual({
      totalBidAmountToday: 100,
      totalWinningAmountToday: 35,
      netProfitToday: 65,
    });
  });
});
