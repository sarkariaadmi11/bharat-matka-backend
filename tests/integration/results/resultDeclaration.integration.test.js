describe('Result declaration canonicalization', () => {
  let declareResult;
  let mocks;
  let mockSession;

  const loadServiceWithMocks = () => {
    jest.resetModules();
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    mocks = {
      gameSessionRepository: {
        findById: jest.fn().mockResolvedValue({
          _id: 'session-1',
          marketId: 'market-1',
          phase: 'open_running',
          openResultDeclared: false,
          resultRevision: 0,
          openTime: new Date('2026-03-15T12:00:00.000Z'),
          closeTime: new Date('2026-03-15T13:00:00.000Z'),
          result: {},
          currentResult: {},
          toObject() {
            return this;
          },
        }),
        declareOpenResult: jest.fn().mockImplementation(async (_sessionId, payload) => ({
          _id: 'session-1',
          marketId: 'market-1',
          phase: 'close_running',
          resultRevision: 1,
          result: {
            openPana: payload.openPana,
            openDigit: payload.openDigit,
            closePana: null,
            closeDigit: null,
          },
          currentResult: {
            openPana: payload.openPana,
            openDigit: payload.openDigit,
            closePana: null,
            closeDigit: null,
          },
          toObject() {
            return this;
          },
        })),
        declareCloseResult: jest.fn().mockImplementation(async (_sessionId, payload) => ({
          _id: 'session-1',
          marketId: 'market-1',
          phase: 'market_closed',
          resultRevision: 2,
          result: {
            openPana: '128',
            openDigit: 1,
            closePana: payload.closePana,
            closeDigit: payload.closeDigit,
          },
          currentResult: {
            openPana: '128',
            openDigit: 1,
            closePana: payload.closePana,
            closeDigit: payload.closeDigit,
          },
          toObject() {
            return this;
          },
        })),
        updateResultState: jest.fn().mockImplementation(async (_sessionId, update) => ({
          _id: 'session-1',
          marketId: 'market-1',
          phase: 'market_closed',
          resultRevision: update.resultRevision || 1,
          settlementStatus: update.settlementStatus || 'processing',
          lastSettlementJobId: update.lastSettlementJobId || 'job-1',
          currentResult: {
            openPana: '120',
            openDigit: 3,
            closePana: null,
            closeDigit: null,
          },
          result: {
            openPana: '120',
            openDigit: 3,
            closePana: null,
            closeDigit: null,
          },
          settledResult: {},
          toObject() {
            return this;
          },
        })),
      },
      betRepository: {
        findPendingBySession: jest.fn().mockResolvedValue([]),
        getPendingExposureSummary: jest.fn(),
      },
      sessionExposureRepository: {
        findBySessionAndMode: jest.fn().mockResolvedValue(null),
        applyDelta: jest.fn(),
      },
      marketRepository: {
        findById: jest.fn().mockResolvedValue({ _id: 'market-1', name: 'Mock Market' }),
      },
      settlementJobRepository: {
        create: jest.fn().mockResolvedValue({ _id: 'job-1' }),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            GameSession: mocks.gameSessionRepository,
            Bet: mocks.betRepository,
            SessionExposure: mocks.sessionExposureRepository,
            Market: mocks.marketRepository,
            SettlementJob: mocks.settlementJobRepository,
          };
          return repoMap[name];
        },
      },
    }));

    jest.doMock('mongoose', () => ({
      startSession: jest.fn().mockResolvedValue(mockSession),
    }));

    jest.doMock('../../../src/infrastructure/queue/eventTaskRegistry', () => ({
      scheduleTask: jest.fn().mockResolvedValue({ _id: 'task-1' }),
    }));

    jest.doMock('../../../src/infrastructure/queue/taskRunnerService', () => ({
      run: jest.fn().mockResolvedValue(undefined),
    }));

    jest.doMock('@modules/results/engine/NotificationDispatcher', () => ({
      dispatchResultDeclared: jest.fn().mockResolvedValue({}),
    }));

    ({ declareResult } = require('@modules/results/engine/ResultApplicationService'));
  };

  beforeEach(() => {
    loadServiceWithMocks();
  });

  test('stores canonical zero-highest pana when admin declares a leading-zero pana', async () => {
    const result = await declareResult({
      sessionId: 'session-1',
      pana: '012',
      sessionPhase: 'open_running',
    });

    expect(mocks.gameSessionRepository.declareOpenResult).toHaveBeenCalledWith(
      'session-1',
      {
        openPana: '120',
        openDigit: 3,
      },
      mockSession,
    );

    expect(result.result.openPana).toBe('120');
    expect(result.derivedDigit).toBe(3);
  });

  test('rejects open result declaration before the open phase has ended', async () => {
    mocks.gameSessionRepository.findById.mockResolvedValueOnce({
      _id: 'session-1',
      marketId: 'market-1',
      phase: 'open_running',
      openResultDeclared: false,
      resultRevision: 0,
      openTime: new Date('2999-03-15T12:00:00.000Z'),
      closeTime: new Date('2999-03-15T13:00:00.000Z'),
      result: {},
      currentResult: {},
      toObject() {
        return this;
      },
    });

    await expect(declareResult({
      sessionId: 'session-1',
      pana: '128',
      sessionPhase: 'open_running',
    })).rejects.toThrow('Open result can only be declared after the open phase has ended');
  });

  test('allows open result declaration in market_closed when open time has already passed', async () => {
    mocks.gameSessionRepository.findById.mockResolvedValueOnce({
      _id: 'session-1',
      marketId: 'market-1',
      phase: 'market_closed',
      openResultDeclared: false,
      resultRevision: 0,
      openTime: new Date('2026-03-15T12:00:00.000Z'),
      closeTime: new Date('2026-03-15T13:00:00.000Z'),
      result: {},
      currentResult: {},
      toObject() {
        return this;
      },
    });

    mocks.gameSessionRepository.declareOpenResult.mockResolvedValueOnce({
      _id: 'session-1',
      marketId: 'market-1',
      phase: 'market_closed',
      resultRevision: 1,
      result: {
        openPana: '128',
        openDigit: 1,
        closePana: null,
        closeDigit: null,
      },
      currentResult: {
        openPana: '128',
        openDigit: 1,
        closePana: null,
        closeDigit: null,
      },
      toObject() {
        return this;
      },
    });

    const result = await declareResult({
      sessionId: 'session-1',
      pana: '128',
      sessionPhase: 'open_running',
    });

    expect(result.declaredPhase).toBe('open_running');
    expect(result.phase).toBe('market_closed');
  });

  test('rejects close result declaration before market close time', async () => {
    mocks.gameSessionRepository.findById.mockResolvedValueOnce({
      _id: 'session-1',
      marketId: 'market-1',
      phase: 'close_running',
      openResultDeclared: true,
      resultRevision: 1,
      openTime: new Date('2026-03-15T12:00:00.000Z'),
      closeTime: new Date('2999-03-15T13:00:00.000Z'),
      result: {
        openPana: '128',
        openDigit: 1,
      },
      currentResult: {
        openPana: '128',
        openDigit: 1,
      },
      toObject() {
        return this;
      },
    });

    await expect(declareResult({
      sessionId: 'session-1',
      pana: '235',
      sessionPhase: 'close_running',
    })).rejects.toThrow('Close result can only be declared after the market close time has passed');
  });

  test('allows close result declaration in market_closed when close time has passed', async () => {
    mocks.gameSessionRepository.findById.mockResolvedValueOnce({
      _id: 'session-1',
      marketId: 'market-1',
      phase: 'market_closed',
      openResultDeclared: true,
      resultRevision: 1,
      openTime: new Date('2026-03-15T12:00:00.000Z'),
      closeTime: new Date('2026-03-15T13:00:00.000Z'),
      result: {
        openPana: '128',
        openDigit: 1,
      },
      currentResult: {
        openPana: '128',
        openDigit: 1,
      },
      toObject() {
        return this;
      },
    });

    const result = await declareResult({
      sessionId: 'session-1',
      pana: '235',
      sessionPhase: 'close_running',
    });

    expect(mocks.gameSessionRepository.declareCloseResult).toHaveBeenCalledWith(
      'session-1',
      {
        closePana: '235',
        closeDigit: 0,
      },
      mockSession,
    );
    expect(result.declaredPhase).toBe('close_running');
    expect(result.phase).toBe('market_closed');
  });
});
