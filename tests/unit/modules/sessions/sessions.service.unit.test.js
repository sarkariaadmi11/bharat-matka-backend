describe('sessions.service validateBettingEligibility', () => {
  let sessionsService;
  let mocks;

  const loadModule = () => {
    jest.resetModules();

    mocks = {
      gameSessionRepository: {
        findById: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        findLean: jest.fn(),
        findLeanByIds: jest.fn(),
        create: jest.fn(),
        setPhase: jest.fn(),
        lockSession: jest.fn(),
      },
      marketRepository: {
        find: jest.fn(),
        findById: jest.fn(),
        findActiveMarkets: jest.fn(),
        findLeanByIds: jest.fn(),
      },
      betRepository: {
        count: jest.fn(),
      },
      globalConfigRepository: {
        findOne: jest.fn(),
      },
    };

    jest.doMock('mongoose', () => ({
      startSession: jest.fn(),
      Types: {
        ObjectId: {
          isValid: jest.fn().mockReturnValue(true),
        },
      },
    }));

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => ({
          GameSession: mocks.gameSessionRepository,
          Market: mocks.marketRepository,
          Bet: mocks.betRepository,
          GlobalConfig: mocks.globalConfigRepository,
        }[name]),
      },
    }));
    jest.doMock('../../../../src/infrastructure/queue/eventTaskRegistry', () => ({}));

    sessionsService = require('@modules/sessions/sessions.service');
  };

  beforeEach(() => {
    loadModule();
  });

  test('blocks open bets after open result declaration', () => {
    expect(() => sessionsService.validateBettingEligibility({
      status: 'active',
      phase: 'open_running',
      openResultDeclared: true,
      openTime: new Date(Date.now() + 60_000),
      closeTime: new Date(Date.now() + 120_000),
    }, 'open')).toThrow('Open betting has ended. Cannot place open bets after open result.');
  });

  test('allows close bets during close_running before close time', () => {
    expect(() => sessionsService.validateBettingEligibility({
      status: 'active',
      phase: 'close_running',
      openResultDeclared: true,
      openTime: new Date(Date.now() - 120_000),
      closeTime: new Date(Date.now() + 60_000),
    }, 'close')).not.toThrow();
  });

  test('returns today sessions ordered by close time without changing response fields', async () => {
    mocks.gameSessionRepository.find.mockResolvedValue([
      {
        _id: 'session-late',
        marketId: 'market-late',
        phase: 'open_running',
        status: 'active',
        openTime: new Date('2026-03-25T09:15:00.000Z'),
        closeTime: new Date('2026-03-25T11:15:00.000Z'),
        result: {},
        createdAt: new Date('2026-03-25T00:02:00.000Z'),
      },
      {
        _id: 'session-early',
        marketId: 'market-early',
        phase: 'open_running',
        status: 'active',
        openTime: new Date('2026-03-25T09:00:00.000Z'),
        closeTime: new Date('2026-03-25T11:00:00.000Z'),
        result: {},
        createdAt: new Date('2026-03-25T00:01:00.000Z'),
      },
    ]);
    mocks.marketRepository.find.mockResolvedValue([
      { _id: 'market-late', name: 'Late Market' },
      { _id: 'market-early', name: 'Early Market' },
    ]);

    const result = await sessionsService.getTodaysSessionsWithMarket();

    expect(result.map((session) => session.sessionId)).toEqual(['session-early', 'session-late']);
    expect(result[0]).not.toHaveProperty('sortCloseTime');
  });

  test('shows cancelled sessions with close status in today session list', async () => {
    mocks.gameSessionRepository.find.mockResolvedValue([
      {
        _id: 'session-active',
        marketId: 'market-active',
        phase: 'open_running',
        status: 'active',
        openTime: new Date('2026-03-25T09:00:00.000Z'),
        closeTime: new Date('2026-03-25T11:00:00.000Z'),
        result: {},
        createdAt: new Date('2026-03-25T00:01:00.000Z'),
      },
      {
        _id: 'session-cancelled',
        marketId: 'market-cancelled',
        phase: 'market_closed',
        status: 'cancelled',
        openTime: new Date('2026-03-25T10:00:00.000Z'),
        closeTime: new Date('2026-03-25T12:00:00.000Z'),
        result: {},
        createdAt: new Date('2026-03-25T00:02:00.000Z'),
      },
    ]);
    mocks.marketRepository.find.mockResolvedValue([
      { _id: 'market-active', name: 'Active Market' },
      { _id: 'market-cancelled', name: 'Cancelled Market' },
    ]);

    const result = await sessionsService.getTodaysSessionsWithMarket();

    expect(result.map((session) => session.sessionId)).toEqual(['session-active', 'session-cancelled']);
    expect(result[1].status).toBe('close');
  });
});
