describe('SettlementOrchestrator final-result settlement', () => {
  let settleResult;
  let shouldSettleBetInPass;
  let mocks;

  const loadModule = () => {
    jest.resetModules();

    mocks = {
      gameSessionRepository: {
        findById: jest.fn(),
        updateResultState: jest.fn(async (_id, payload) => ({
          _id: 'session-1',
          status: 'active',
          phase: 'market_closed',
          resultRevision: 2,
          settledResultRevision: payload.settledResultRevision || 0,
          settlementStatus: payload.settlementStatus || 'completed',
          result: {
            openPana: '128',
            openDigit: 5,
            closePana: '347',
            closeDigit: 4,
          },
          currentResult: {
            openPana: '128',
            openDigit: 5,
            closePana: '347',
            closeDigit: 4,
          },
          settledResult: payload.settledResult || {},
          toObject() {
            return this;
          },
        })),
        markSettled: jest.fn().mockResolvedValue({
          _id: 'session-1',
          status: 'settled',
          phase: 'settled',
          resultRevision: 2,
          settledResultRevision: 2,
          settlementStatus: 'completed',
          currentResult: {
            openPana: '128',
            openDigit: 5,
            closePana: '347',
            closeDigit: 4,
          },
          settledResult: {
            openPana: '128',
            openDigit: 5,
            closePana: '347',
            closeDigit: 4,
          },
          toObject() {
            return this;
          },
        }),
      },
      betRepository: {
        findPendingBySession: jest.fn(),
      },
      settlementJobRepository: {
        markProcessing: jest.fn(),
        markCompleted: jest.fn(),
        markFailed: jest.fn(),
      },
      settlementService: {
        processBatchSettlement: jest.fn().mockResolvedValue({ success: true }),
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

    ({ settleResult, shouldSettleBetInPass } = require('@modules/results/engine/SettlementOrchestrator'));
  };

  beforeEach(() => {
    loadModule();
  });

  test('selects candidates correctly for open and close settlement passes', () => {
    expect(shouldSettleBetInPass({ betMode: 'open', gameTypeCodeSnapshot: 'SINGLE' }, 'open')).toBe(true);
    expect(shouldSettleBetInPass({ betMode: 'open', gameTypeCodeSnapshot: 'JODI' }, 'open')).toBe(false);
    expect(shouldSettleBetInPass({ betMode: 'close', gameTypeCodeSnapshot: 'SINGLE' }, 'open')).toBe(false);
    expect(shouldSettleBetInPass({ betMode: 'close', gameTypeCodeSnapshot: 'SINGLE' }, 'close')).toBe(true);
    expect(shouldSettleBetInPass({ betMode: 'open', gameTypeCodeSnapshot: 'JODI' }, 'close')).toBe(true);
    expect(shouldSettleBetInPass({ betMode: 'open', gameTypeCodeSnapshot: 'SINGLE' }, 'close')).toBe(false);
  });

  test('settles deferred open jodi bets during close settlement and marks session settled', async () => {
    mocks.gameSessionRepository.findById.mockResolvedValue({
      _id: 'session-1',
      status: 'active',
      phase: 'market_closed',
      resultRevision: 2,
      result: {
        openPana: '128',
        openDigit: 5,
        closePana: '347',
        closeDigit: 4,
      },
      currentResult: {
        openPana: '128',
        openDigit: 5,
        closePana: '347',
        closeDigit: 4,
      },
      settledResult: {
        openPana: '128',
        openDigit: 5,
      },
      toObject() {
        return this;
      },
    });

    mocks.betRepository.findPendingBySession
      .mockResolvedValueOnce([
        {
          _id: 'bet-jodi-win',
          userId: 'user-1',
          betMode: 'open',
          selection: '54',
          gameTypeCodeSnapshot: 'JODI',
          amount: 1000,
          oddsSnapshot: 90,
        },
        {
          _id: 'bet-close-win',
          userId: 'user-2',
          betMode: 'close',
          selection: '4',
          gameTypeCodeSnapshot: 'SINGLE',
          amount: 500,
          oddsSnapshot: 9,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await settleResult({ sessionId: 'session-1', betMode: 'close' });

    expect(mocks.settlementService.processBatchSettlement).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ _id: 'bet-jodi-win' }),
        expect.objectContaining({ _id: 'bet-close-win' }),
      ]),
      [],
    );
    expect(mocks.gameSessionRepository.markSettled).toHaveBeenCalledWith('session-1');
    expect(result).toEqual({
      sessionId: 'session-1',
      betMode: 'close',
      totalWinningBets: 2,
      totalLosingBets: 0,
      deferredBets: 0,
      totalPayout: 94500,
    });
  });

  test('does not mark session settled when unrelated pending bets remain after close settlement', async () => {
    mocks.gameSessionRepository.findById.mockResolvedValue({
      _id: 'session-1',
      status: 'active',
      phase: 'market_closed',
      resultRevision: 2,
      result: {
        openPana: '128',
        openDigit: 5,
        closePana: '347',
        closeDigit: 4,
      },
      currentResult: {
        openPana: '128',
        openDigit: 5,
        closePana: '347',
        closeDigit: 4,
      },
      settledResult: {
        openPana: '128',
        openDigit: 5,
      },
      toObject() {
        return this;
      },
    });

    const leftoverOpenSingle = {
      _id: 'bet-open-single',
      userId: 'user-3',
      betMode: 'open',
      selection: '5',
      gameTypeCodeSnapshot: 'SINGLE',
      amount: 100,
      oddsSnapshot: 9,
    };

    mocks.betRepository.findPendingBySession
      .mockResolvedValueOnce([leftoverOpenSingle])
      .mockResolvedValueOnce([leftoverOpenSingle]);

    const result = await settleResult({ sessionId: 'session-1', betMode: 'close' });

    expect(mocks.settlementService.processBatchSettlement).toHaveBeenCalledWith([], []);
    expect(mocks.gameSessionRepository.markSettled).not.toHaveBeenCalled();
    expect(result).toEqual({
      sessionId: 'session-1',
      betMode: 'close',
      totalWinningBets: 0,
      totalLosingBets: 0,
      deferredBets: 1,
      totalPayout: 0,
    });
  });
});
