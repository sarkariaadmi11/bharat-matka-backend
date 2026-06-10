describe('Wallet settlement integration smoke', () => {
  let processBatchSettlement;
  let mocks;
  let transactionSession;

  const loadServiceWithMocks = () => {
    jest.resetModules();

    transactionSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    mocks = {
      walletRepository: {
        settleWin: jest.fn().mockResolvedValue({ balance: 12000 }),
        settleLoss: jest.fn().mockResolvedValue({ balance: 12000 }),
      },
      transactionRepository: {
        findBetDebitTransactionsByBetIds: jest.fn().mockResolvedValue([
          { _id: 'tx-debit-1', betIds: ['bet-win-1'] },
        ]),
        recordWinCredit: jest.fn().mockResolvedValue({}),
      },
      betRepository: {
        update: jest.fn().mockResolvedValue({}),
      },
      gameSessionRepository: {
        findLeanByIds: jest.fn().mockResolvedValue([{ _id: 'session-1', marketId: 'market-1' }]),
      },
      marketRepository: {
        findLeanByIds: jest.fn().mockResolvedValue([{ _id: 'market-1', code: 'MK1', name: 'Mock Market' }]),
      },
    };

    jest.doMock('mongoose', () => ({
      startSession: jest.fn().mockResolvedValue(transactionSession),
    }));

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            Wallet: mocks.walletRepository,
            Transaction: mocks.transactionRepository,
            Bet: mocks.betRepository,
            GameSession: mocks.gameSessionRepository,
            Market: mocks.marketRepository,
          };
          return repoMap[name];
        },
      },
    }));

    ({ processBatchSettlement } = require('@modules/results/settlementService'));
  };

  beforeEach(() => {
    loadServiceWithMocks();
  });

  test('distributes payout to winners and settles losers', async () => {
    // Arrange
    const winningBets = [
      {
        _id: 'bet-win-1',
        userId: 'user-1',
        sessionId: 'session-1',
        gameTypeCodeSnapshot: 'SP_MOTOR',
        selection: '123,125,135',
        betMode: 'close',
        amount: 1000,
        oddsSnapshot: 9,
      },
    ];
    const losingBets = [
      { _id: 'bet-lose-1', userId: 'user-2', amount: 500, oddsSnapshot: 9 },
    ];

    // Act
    const result = await processBatchSettlement(winningBets, losingBets);

    // Assert
    expect(mocks.walletRepository.settleWin).toHaveBeenCalledWith('user-1', 1000, 9000, transactionSession);
    expect(mocks.transactionRepository.recordWinCredit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 9000,
        relatedTransactionId: 'tx-debit-1',
        sessionId: 'session-1',
        marketCode: 'MK1',
        gameTypeCode: 'SP_MOTOR',
        selections: ['123,125,135'],
        betMode: 'close',
        referenceId: 'bet-win-1',
      }),
      transactionSession,
    );
    expect(mocks.walletRepository.settleLoss).toHaveBeenCalledWith('user-2', 500, transactionSession);

    expect(mocks.betRepository.update).toHaveBeenNthCalledWith(
      1,
      'bet-win-1',
      expect.objectContaining({ status: 'won', payout: 9000 }),
      transactionSession,
    );
    expect(mocks.betRepository.update).toHaveBeenNthCalledWith(
      2,
      'bet-lose-1',
      expect.objectContaining({ status: 'lost', payout: 0 }),
      transactionSession,
    );

    expect(transactionSession.commitTransaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true });
  });
});
