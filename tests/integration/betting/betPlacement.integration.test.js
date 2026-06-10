const { BET_STATUS } = require('@config/constants/domain');

describe('Bet placement integration smoke', () => {
  let placeBetsFromRequest;
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
      gameTypeRepository: {
        findById: jest.fn().mockResolvedValue({
          _id: 'gt1',
          code: 'SINGLE',
          payoutMultiplier: 9,
          rules: {
            allowedBetModes: ['open', 'close'],
            parts: [{ name: 'digit', type: 'digit', length: 1 }],
          },
          betPhaseType: 'both',
          templateKey: 'SINGLE_DIGIT',
          rulesVersion: 1,
        }),
      },
      gameSessionRepository: {
        findById: jest.fn().mockResolvedValue({
          _id: 'session1',
          marketId: 'market1',
          status: 'active',
          phase: 'open_running',
          openResultDeclared: false,
          openTime: new Date('2099-01-01T10:00:00.000Z'),
          closeTime: new Date('2099-01-01T11:00:00.000Z'),
          gameTypesSnapshot: [{
            gameTypeId: 'gt1',
            code: 'SINGLE',
            name: 'Single',
            betPhaseType: 'both',
            payoutMultiplier: 9,
            minBet: 10,
            maxBet: 1000,
            status: 'active',
          }],
        }),
      },
      marketRepository: {
        findById: jest.fn().mockResolvedValue({
          _id: 'market1',
          code: 'MK1',
        }),
        model: {},
      },
      walletRepository: {
        placeBetDebit: jest.fn().mockResolvedValue({ balance: 9000 }),
      },
      betRepository: {
        createBet: jest
          .fn()
          .mockResolvedValueOnce({
            _id: 'bet1',
            selection: '4',
            amount: 1000,
            oddsSnapshot: 9,
            betMode: 'open',
            gameTypeCodeSnapshot: 'SINGLE',
          })
          .mockResolvedValueOnce({
            _id: 'bet2',
            selection: '7',
            amount: 2000,
            oddsSnapshot: 9,
            betMode: 'open',
            gameTypeCodeSnapshot: 'SINGLE',
          }),
      },
      transactionRepository: {
        recordBetDebit: jest.fn().mockResolvedValue({}),
      },
      sessionExposureRepository: {
        applyDelta: jest.fn().mockResolvedValue({}),
      },
      globalConfigRepository: {
        getOrCreateActiveConfig: jest.fn().mockResolvedValue({
          globalBetting: true,
          minimumBidAmount: 1,
          maximumBidAmount: 100000,
          minimumDeposit: 1,
          maximumDeposit: 100000,
          minimumWithdrawal: 1,
          maximumWithdrawal: 100000,
          welcomeBonus: 5,
          withdrawOpenTime: '00:00',
          withdrawCloseTime: '23:59',
          resultDeclarationGraceHours: 5,
        }),
      },
    };

    jest.doMock('mongoose', () => ({
      startSession: jest.fn().mockResolvedValue(transactionSession),
      Types: {
        ObjectId: {
          isValid: jest.fn().mockReturnValue(false),
        },
      },
    }));

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            Wallet: mocks.walletRepository,
            Bet: mocks.betRepository,
            Transaction: mocks.transactionRepository,
            SessionExposure: mocks.sessionExposureRepository,
            GameSession: mocks.gameSessionRepository,
            GameType: mocks.gameTypeRepository,
            Market: mocks.marketRepository,
            GlobalConfig: mocks.globalConfigRepository,
          };

          return repoMap[name];
        },
      },
    }));

    ({ placeBetsFromRequest } = require('@modules/bets/bets.service'));
  };

  beforeEach(() => {
    loadServiceWithMocks();
  });

  test('places bets and deducts wallet balance atomically', async () => {
    // Arrange
    const payload = {
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt1',
      bets: [
        { value: { digit: '4' }, amount: 10, betMode: 'open' },
        { value: { digit: '7' }, amount: 20, betMode: 'open' },
      ],
    };

    // Act
    const response = await placeBetsFromRequest(payload);

    // Assert
    expect(mocks.walletRepository.placeBetDebit).toHaveBeenCalledWith('user1', 3000, transactionSession);
    expect(mocks.betRepository.createBet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 'user1',
        sessionId: 'session1',
        gameTypeId: 'gt1',
        selection: '4',
        amount: 1000,
        oddsSnapshot: 9,
        status: BET_STATUS.PENDING,
      }),
      transactionSession,
    );
    expect(mocks.betRepository.createBet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        selection: '7',
        amount: 2000,
      }),
      transactionSession,
    );
    expect(transactionSession.commitTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.sessionExposureRepository.applyDelta).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session1',
        mode: 'open',
      }),
    );
    expect(response).toEqual({
      totalBets: 2,
      totalAmount: 30,
      balance: 90,
    });
  });

  test('rejects bet placement when wallet balance is insufficient', async () => {
    // Arrange
    mocks.walletRepository.placeBetDebit.mockRejectedValue(new Error('Insufficient balance or wallet not found'));

    const payload = {
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt1',
      bets: [{ value: { digit: '4' }, amount: 10, betMode: 'open' }],
    };

    // Act / Assert
    await expect(placeBetsFromRequest(payload)).rejects.toThrow('Insufficient balance');
    expect(mocks.sessionExposureRepository.applyDelta).not.toHaveBeenCalled();
    expect(transactionSession.abortTransaction).toHaveBeenCalled();
  });

  test('allows mixed bet modes in a single request and writes both bets', async () => {
    mocks.betRepository.createBet.mockReset();
    mocks.betRepository.createBet
      .mockResolvedValueOnce({
        _id: 'bet1',
        selection: '4',
        amount: 1000,
        oddsSnapshot: 9,
        betMode: 'open',
        gameTypeCodeSnapshot: 'SINGLE',
      })
      .mockResolvedValueOnce({
        _id: 'bet2',
        selection: '7',
        amount: 2000,
        oddsSnapshot: 9,
        betMode: 'close',
        gameTypeCodeSnapshot: 'SINGLE',
      });

    const payload = {
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt1',
      bets: [
        { value: { digit: '4' }, amount: 10, betMode: 'open' },
        { value: { digit: '7' }, amount: 20, betMode: 'close' },
      ],
    };

    await placeBetsFromRequest(payload);

    expect(mocks.walletRepository.placeBetDebit).toHaveBeenCalledWith('user1', 3000, transactionSession);
    expect(mocks.betRepository.createBet).toHaveBeenCalledTimes(2);
  });

  test('isolates each bet item when the request reuses the same nested value object', async () => {
    const sharedValue = { digit: '4' };
    const capturedPayloads = [];

    mocks.betRepository.createBet.mockReset();
    mocks.betRepository.createBet
      .mockImplementationOnce(async (payload) => {
        capturedPayloads.push({
          selection: payload.selection,
          amount: payload.amount,
        });
        payload.selection = 'mutated-by-first-call';
        payload.amount = 9999;
        payload.generatedPanas = ['x'];

        return {
          _id: 'bet1',
          selection: payload.selection,
          amount: payload.amount,
          oddsSnapshot: 9,
          betMode: payload.betMode,
          gameTypeCodeSnapshot: 'SINGLE',
        };
      })
      .mockImplementationOnce(async (payload) => {
        capturedPayloads.push({
          selection: payload.selection,
          amount: payload.amount,
        });

        return {
          _id: 'bet2',
          selection: payload.selection,
          amount: payload.amount,
          oddsSnapshot: 9,
          betMode: payload.betMode,
          gameTypeCodeSnapshot: 'SINGLE',
        };
      });

    await placeBetsFromRequest({
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt1',
      bets: [
        { value: sharedValue, amount: 10, betMode: 'open' },
        { value: sharedValue, amount: 10, betMode: 'open' },
      ],
    });

    expect(capturedPayloads).toEqual([
      { selection: '4', amount: 1000 },
      { selection: '4', amount: 1000 },
    ]);
  });

  test('rejects close bet for jodi because it is open-only centrally', async () => {
    mocks.gameTypeRepository.findById.mockResolvedValue({
      _id: 'gt-jodi',
      code: 'JODI',
      payoutMultiplier: 90,
      rules: {
        allowedBetModes: ['open'],
        parts: [{ name: 'jodi', type: 'digit', length: 2 }],
      },
      betPhaseType: 'open_only',
      templateKey: 'JODI',
      rulesVersion: 1,
    });
    mocks.gameSessionRepository.findById.mockResolvedValue({
      _id: 'session1',
      marketId: 'market1',
      status: 'active',
      phase: 'open_running',
      openResultDeclared: false,
      openTime: new Date('2099-01-01T10:00:00.000Z'),
      closeTime: new Date('2099-01-01T11:00:00.000Z'),
      gameTypesSnapshot: [{
        gameTypeId: 'gt-jodi',
        code: 'JODI',
        name: 'Jodi',
        betPhaseType: 'open_only',
        payoutMultiplier: 90,
        minBet: 10,
        maxBet: 1000,
        status: 'active',
      }],
    });

    const payload = {
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt-jodi',
      bets: [{ value: { jodi: '47' }, amount: 10, betMode: 'close' }],
    };

    await expect(placeBetsFromRequest(payload)).rejects.toThrow('Bet mode not allowed for this game');
    expect(mocks.walletRepository.placeBetDebit).not.toHaveBeenCalled();
    expect(mocks.betRepository.createBet).not.toHaveBeenCalled();
  });
});
