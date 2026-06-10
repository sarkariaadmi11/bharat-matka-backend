describe('admin result reset service', () => {
  let resultService;
  let mockMongoSession;
  let mockSessionEntity;
  let mocks;

  const createSessionEntity = (overrides = {}) => ({
    _id: 'session-1',
    phase: 'market_closed',
    openResultDeclared: true,
    resultRevision: 3,
    settledResultRevision: 2,
    settlementStatus: 'completed',
    result: {
      openPana: '128',
      openDigit: 1,
      openDeclaredAt: new Date('2026-04-24T10:00:00.000Z'),
      closePana: '235',
      closeDigit: 0,
      closeDeclaredAt: new Date('2026-04-24T11:00:00.000Z'),
    },
    currentResult: {
      openPana: '128',
      openDigit: 1,
      openDeclaredAt: new Date('2026-04-24T10:00:00.000Z'),
      closePana: '235',
      closeDigit: 0,
      closeDeclaredAt: new Date('2026-04-24T11:00:00.000Z'),
    },
    settledResult: {
      openPana: '128',
      openDigit: 1,
      openDeclaredAt: new Date('2026-04-24T10:00:00.000Z'),
      closePana: '235',
      closeDigit: 0,
      closeDeclaredAt: new Date('2026-04-24T11:00:00.000Z'),
    },
    toObject() {
      return {
        ...this,
        result: { ...this.result },
        currentResult: { ...this.currentResult },
        settledResult: { ...this.settledResult },
      };
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.resetModules();

    mockMongoSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    mockSessionEntity = createSessionEntity();

    mocks = {
      gameSessionService: {
        getSessionById: jest.fn().mockResolvedValue(mockSessionEntity),
      },
      gameSessionRepository: {
        findById: jest.fn(),
        updateResultState: jest.fn().mockImplementation(async (_sessionId, updates) => ({
          ...mockSessionEntity.toObject(),
          ...updates,
          _id: 'session-1',
          toObject() {
            return this;
          },
        })),
      },
      betRepository: {
        findPendingBySession: jest.fn(),
      },
      userRepository: {
        find: jest.fn(),
      },
      gameTypeRepository: {
        findLeanByIds: jest.fn().mockResolvedValue([]),
      },
      marketRepository: {
        findById: jest.fn(),
      },
      resultAuditRecordRepository: {
        create: jest.fn().mockResolvedValue({ _id: 'audit-1' }),
      },
      logger: {
        info: jest.fn(),
      },
      mongoose: {
        startSession: jest.fn().mockResolvedValue(mockMongoSession),
      },
    };

    jest.doMock('mongoose', () => mocks.mongoose);
    jest.doMock('@modules/sessions/sessions.service', () => mocks.gameSessionService);
    jest.doMock('@modules/results/engine/ResultApplicationService', () => ({
      declareResult: jest.fn(),
    }));
    jest.doMock('@utils/logger', () => mocks.logger);
    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            GameSession: mocks.gameSessionRepository,
            Bet: mocks.betRepository,
            User: mocks.userRepository,
            GameType: mocks.gameTypeRepository,
            Market: mocks.marketRepository,
            ResultAuditRecord: mocks.resultAuditRecordRepository,
          };

          return repoMap[name];
        },
      },
    }));

    resultService = require('@modules/admin/results/result.service');
  });

  test('resetOpenResult clears the open result and marks the session financially inconsistent', async () => {
    const result = await resultService.resetOpenResult({
      sessionId: 'session-1',
      adminUserId: 'admin-1',
      reason: 'Incorrect operator feed',
      note: 'Will redeclare after verification',
      expectedResultRevision: 3,
    });

    expect(mocks.gameSessionRepository.updateResultState).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        openResultDeclared: false,
        resultRevision: 4,
        currentResult: expect.objectContaining({
          openPana: null,
          openDigit: null,
          openDeclaredAt: null,
          closePana: '235',
          closeDigit: 0,
        }),
        result: expect.objectContaining({
          openPana: null,
          openDigit: null,
          openDeclaredAt: null,
        }),
        isFinanciallyConsistent: false,
        financialInconsistencyReason: 'RESULT_FINANCIAL_DIVERGENCE',
      }),
      mockMongoSession,
    );

    expect(mocks.resultAuditRecordRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reset_open',
        beforeSnapshot: expect.objectContaining({
          openPana: '128',
          openDigit: 1,
        }),
        afterSnapshot: expect.objectContaining({
          openPana: null,
          openDigit: null,
          closePana: '235',
          closeDigit: 0,
        }),
      }),
      mockMongoSession,
    );

    expect(mockMongoSession.commitTransaction).toHaveBeenCalled();
    expect(result.currentResult.openPana).toBeNull();
    expect(result.currentResult.closePana).toBe('235');
    expect(result.isFinanciallyConsistent).toBe(false);
    expect(result.resetReason).toBe('Incorrect operator feed');
  });

  test('resetCloseResult clears only the close result and preserves open declaration state', async () => {
    const result = await resultService.resetCloseResult({
      sessionId: 'session-1',
      adminUserId: 'admin-1',
      reason: 'Incorrect close declaration',
    });

    expect(mocks.gameSessionRepository.updateResultState).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        openResultDeclared: true,
        resultRevision: 4,
        currentResult: expect.objectContaining({
          openPana: '128',
          openDigit: 1,
          closePana: null,
          closeDigit: null,
          closeDeclaredAt: null,
        }),
      }),
      mockMongoSession,
    );

    expect(mocks.resultAuditRecordRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'reset_close',
      }),
      mockMongoSession,
    );

    expect(result.currentResult.openPana).toBe('128');
    expect(result.currentResult.closePana).toBeNull();
  });

  test('previewWinnersForResult accepts documented uppercase phase values', async () => {
    const previewSession = createSessionEntity({
      marketId: 'market-1',
      phase: 'open_running',
    });
    const previewBet = {
      _id: 'bet-1',
      userId: 'user-1',
      gameTypeId: 'gt-1',
      selection: '123',
      amount: 1000,
      betMode: 'open',
      createdAt: new Date('2026-04-24T09:00:00.000Z'),
    };

    const splitWinnersAndLosers = jest.fn().mockReturnValue({ winners: [previewBet], losers: [] });
    const calculatePayout = jest.fn().mockReturnValue(9000);

    mocks.gameSessionRepository.findById = jest.fn().mockResolvedValue(previewSession);
    mocks.betRepository.findPendingBySession.mockResolvedValue([previewBet]);
    mocks.userRepository.find.mockResolvedValue([{ _id: 'user-1', username: 'alice' }]);
    mocks.gameTypeRepository.findLeanByIds.mockResolvedValue([{ _id: 'gt-1', code: 'SINGLE' }]);
    mocks.marketRepository.findById.mockResolvedValue({ _id: 'market-1', code: 'MKT' });

    jest.doMock('@domain/rule-engine', () => ({
      BettingRuleEngine: jest.fn().mockImplementation(() => ({
        calculatePayout,
      })),
      ResultEvaluator: {
        splitWinnersAndLosers,
      },
    }));

    resultService = require('@modules/admin/results/result.service');

    const result = await resultService.previewWinnersForResult({
      sessionId: 'session-1',
      phase: 'OPEN_RUNNING',
      pana: '123',
      page: 1,
      limit: 10,
    });

    expect(result.previewInfo.phase).toBe('open_running');
    expect(result.summary.totalWinningBets).toBe(1);
    expect(result.summary.totalPreviewRows).toBe(1);
    expect(result.summary.totalWinners).toBe(1);
    expect(result.data[0]).toEqual(expect.objectContaining({
      username: 'alice',
      session: 'Open',
      payout: 90,
    }));
    expect(splitWinnersAndLosers).toHaveBeenCalled();
    expect(calculatePayout).toHaveBeenCalledWith({ bet: previewBet, resultPana: '123' });
  });

});
