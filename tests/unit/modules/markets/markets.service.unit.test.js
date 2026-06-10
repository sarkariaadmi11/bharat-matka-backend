describe('markets.service', () => {
  let marketsService;
  let mocks;

  beforeEach(() => {
    jest.resetModules();

    mocks = {
      marketRepository: {
        findActiveWithGameTypes: jest.fn(),
        findAllWithGameTypes: jest.fn(),
        findLeanByIds: jest.fn(),
        findByCode: jest.fn(),
      },
      gameSessionRepository: {
        findTodayByMarketIds: jest.fn(),
        findOneLean: jest.fn(),
      },
      globalConfigRepository: {
        findOne: jest.fn(),
      },
      gameTypeRepository: {
        findActiveLean: jest.fn(),
      },
    };

    jest.doMock('@utils/timezoneHelper', () => ({
      getSessionDateIST: jest.fn(() => new Date('2026-03-25T00:00:00.000Z')),
      formatISTTime: jest.fn((value) => new Date(value).toISOString()),
    }));

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            Market: mocks.marketRepository,
            GameSession: mocks.gameSessionRepository,
            GlobalConfig: mocks.globalConfigRepository,
            GameType: mocks.gameTypeRepository,
          };

          return repoMap[name];
        },
      },
    }));

    marketsService = require('@modules/markets/markets.service');
  });

  test('returns active markets ordered by today close time', async () => {
    const markets = [
      {
        _id: 'market-1',
        name: 'Late Market',
        code: 'LATE',
        gameTypes: [],
      },
      {
        _id: 'market-2',
        name: 'Early Market',
        code: 'EARLY',
        gameTypes: [],
      },
    ];

    mocks.marketRepository.findActiveWithGameTypes.mockResolvedValue(markets);
    mocks.gameSessionRepository.findTodayByMarketIds.mockResolvedValue([
      {
        _id: 'session-1',
        marketId: 'market-1',
        status: 'active',
        phase: 'open_running',
        openTime: new Date('2026-03-25T13:00:00.000Z'),
        closeTime: new Date('2026-03-25T17:00:00.000Z'),
        openResultDeclared: false,
      },
      {
        _id: 'session-2',
        marketId: 'market-2',
        status: 'active',
        phase: 'open_running',
        openTime: new Date('2026-03-25T10:00:00.000Z'),
        closeTime: new Date('2026-03-25T12:00:00.000Z'),
        openResultDeclared: false,
      },
    ]);

    const result = await marketsService.getMarketsWithStatus();

    expect(result.map((market) => market.code)).toEqual(['EARLY', 'LATE']);
  });

  test('includes markets with cancelled sessions showing closed status', async () => {
    mocks.marketRepository.findActiveWithGameTypes.mockResolvedValue([
      {
        _id: 'market-1',
        name: 'Visible Market',
        code: 'VISIBLE',
        gameTypes: [],
      },
      {
        _id: 'market-2',
        name: 'Cancelled Market',
        code: 'CANCELLED',
        gameTypes: [],
      },
    ]);
    mocks.gameSessionRepository.findTodayByMarketIds.mockResolvedValue([
      {
        _id: 'session-1',
        marketId: 'market-1',
        status: 'active',
        phase: 'open_running',
        openTime: new Date('2026-03-25T10:00:00.000Z'),
        closeTime: new Date('2026-03-25T12:00:00.000Z'),
        openResultDeclared: false,
      },
      {
        _id: 'session-2',
        marketId: 'market-2',
        status: 'cancelled',
        phase: 'market_closed',
        openTime: new Date('2026-03-25T11:00:00.000Z'),
        closeTime: new Date('2026-03-25T13:00:00.000Z'),
        openResultDeclared: false,
      },
    ]);

    const result = await marketsService.getMarketsWithStatus();

    expect(result.map((market) => market.code)).toEqual(['VISIBLE', 'CANCELLED']);
    expect(result[1].session).toEqual({
      id: 'session-2',
      phase: 'market_closed',
      status: 'cancelled',
      openTime: expect.any(String),
      closeTime: expect.any(String),
      isOpen: false,
    });
  });

  test('resolves market status using market code route param', async () => {
    mocks.marketRepository.findByCode.mockResolvedValue({
      _id: 'market-1',
      status: 'active',
      name: 'Test Market',
      code: 'TEST',
    });

    mocks.gameSessionRepository.findOneLean.mockResolvedValue({
      _id: 'session-1',
      status: 'active',
      phase: 'open_running',
      openTime: new Date('2026-03-25T10:00:00.000Z'),
      closeTime: new Date('2026-03-25T12:00:00.000Z'),
      marketId: 'market-1',
      result: null,
    });

    const result = await marketsService.getMarketStatus('test');

    expect(mocks.marketRepository.findByCode).toHaveBeenCalledWith('test');
    expect(result.market).toEqual({
      id: 'market-1',
      name: 'Test Market',
      code: 'TEST',
    });
  });
});
