describe('Bet flow e2e smoke', () => {
  let settleResult;
  let mocks;

  const loadOrchestratorWithMocks = () => {
    jest.resetModules();

    mocks = {
      gameSessionRepository: {
        findById: jest.fn().mockResolvedValue({
          _id: 'session-1',
          resultRevision: 1,
          result: {
            openPana: '128',
            openDigit: 1,
            closePana: '137',
            closeDigit: 1,
          },
          currentResult: {
            openPana: '128',
            openDigit: 1,
            closePana: '137',
            closeDigit: 1,
          },
          settledResult: {},
          settlementStatus: 'processing',
        }),
        updateResultState: jest.fn().mockImplementation(async (_sessionId, updates) => ({
          _id: 'session-1',
          resultRevision: updates.settledResultRevision || 1,
          result: {
            openPana: '128',
            openDigit: 1,
            closePana: '137',
            closeDigit: 1,
          },
          currentResult: {
            openPana: '128',
            openDigit: 1,
            closePana: '137',
            closeDigit: 1,
          },
          settledResult: updates.settledResult || {},
          settlementStatus: updates.settlementStatus || 'completed',
          toObject() {
            return this;
          },
        })),
        markSettled: jest.fn(),
      },
      betRepository: {
        findPendingBySession: jest.fn().mockResolvedValue([
          { _id: 'b1', userId: 'u1', betMode: 'open', selection: '1', gameTypeCodeSnapshot: 'SINGLE', amount: 1000, oddsSnapshot: 9 },
          { _id: 'b2', userId: 'u2', betMode: 'open', selection: '9', gameTypeCodeSnapshot: 'SINGLE', amount: 500, oddsSnapshot: 9 },
          { _id: 'b3', userId: 'u3', betMode: 'open', selection: '128', gameTypeCodeSnapshot: 'SP', amount: 200, oddsSnapshot: 150 },
        ]),
      },
      settlementService: {
        processBatchSettlement: jest.fn().mockResolvedValue({ success: true }),
      },
      settlementJobRepository: {
        markProcessing: jest.fn(),
        markCompleted: jest.fn(),
        markFailed: jest.fn(),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            GameSession: mocks.gameSessionRepository,
            Bet: mocks.betRepository,
            SettlementJob: mocks.settlementJobRepository,
          };
          return repoMap[name];
        },
      },
    }));

    jest.doMock('@modules/results/settlementService', () => mocks.settlementService);

    ({ settleResult } = require('@modules/results/engine/SettlementOrchestrator'));
  };

  beforeEach(() => {
    loadOrchestratorWithMocks();
  });

  test('evaluates result and produces settlement summary with payout total', async () => {
    // Arrange
    const request = { sessionId: 'session-1', betMode: 'open' };

    // Act
    const summary = await settleResult(request);

    // Assert
    expect(mocks.settlementService.processBatchSettlement).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ _id: 'b1' }),
        expect.objectContaining({ _id: 'b3' }),
      ]),
      expect.arrayContaining([expect.objectContaining({ _id: 'b2' })]),
    );

    expect(summary).toEqual({
      sessionId: 'session-1',
      betMode: 'open',
      totalWinningBets: 2,
      totalLosingBets: 1,
      deferredBets: 0,
      totalPayout: 39000,
    });
  });
});
