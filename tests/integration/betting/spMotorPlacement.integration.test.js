const { BET_STATUS } = require('@config/constants/domain');

describe('Motor placement integration', () => {
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
        findById: jest.fn(),
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
            gameTypeId: 'gt_motor',
            code: 'SP_MOTOR',
            name: 'SP Motor',
            betPhaseType: 'both',
            payoutMultiplier: 120,
            minBet: 1,
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
        placeBetDebit: jest.fn().mockResolvedValue({ balance: 500000 }),
      },
      betRepository: {
        createBet: jest.fn().mockImplementation(async (payload) => ({ _id: 'bet1', ...payload })),
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

  test('stores motor snapshot fields and expands exposure in same transaction', async () => {
    mocks.gameTypeRepository.findById.mockResolvedValue({
      _id: 'gt_motor',
      code: 'SP_MOTOR',
      templateKey: 'SP_MOTOR',
      payoutMultiplier: 120,
      rules: {
        allowedBetModes: ['open', 'close'],
        parts: [{ name: 'panas', type: 'pana_set', minItems: 1, panaKind: 'single' }],
        separator: ',',
      },
      betPhaseType: 'both',
      rulesVersion: 1,
    });

    await placeBetsFromRequest({
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt_motor',
      bets: [{ value: { panas: ['123', '124', '134', '234'] }, amount: 100, betMode: 'open' }],
    });

    expect(mocks.betRepository.createBet).toHaveBeenCalledWith(
      expect.objectContaining({
        gameTypeCodeSnapshot: 'SP_MOTOR',
        gameTypeTemplateKey: 'SP_MOTOR',
        status: BET_STATUS.PENDING,
        selection: '123,124,134,234',
        generatedPanas: ['123', '124', '134', '234'],
        combinationCount: 4,
        stakePerCombination: 2500,
      }),
      transactionSession,
    );

    expect(mocks.sessionExposureRepository.applyDelta).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session1',
        mode: 'open',
        delta: expect.objectContaining({
          totalCollection: 10000,
          panaExposure: {
            '123': 300000,
            '124': 300000,
            '134': 300000,
            '234': 300000,
          },
        }),
      }),
    );

    expect(transactionSession.commitTransaction).toHaveBeenCalled();
  });

  test('rolls back and leaves exposure unchanged when recording transaction fails', async () => {
    mocks.gameTypeRepository.findById.mockResolvedValue({
      _id: 'gt_motor',
      code: 'SP_MOTOR',
      templateKey: 'SP_MOTOR',
      payoutMultiplier: 120,
      rules: {
        allowedBetModes: ['open', 'close'],
        parts: [{ name: 'panas', type: 'pana_set', minItems: 1, panaKind: 'single' }],
        separator: ',',
      },
      betPhaseType: 'both',
      rulesVersion: 1,
    });

    mocks.transactionRepository.recordBetDebit.mockRejectedValue(new Error('tx write fail'));

    await expect(placeBetsFromRequest({
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt_motor',
      bets: [{ value: { panas: ['123', '124', '134', '234'] }, amount: 100, betMode: 'open' }],
    })).rejects.toThrow('tx write fail');

    expect(mocks.sessionExposureRepository.applyDelta).not.toHaveBeenCalled();
    expect(transactionSession.abortTransaction).toHaveBeenCalled();
  });

  test('stores DP_MOTOR snapshot fields and expands exposure', async () => {
    mocks.gameTypeRepository.findById.mockResolvedValue({
      _id: 'gt_motor',
      code: 'DP_MOTOR',
      templateKey: 'DP_MOTOR',
      payoutMultiplier: 250,
      rules: {
        allowedBetModes: ['open', 'close'],
        parts: [{ name: 'panas', type: 'pana_set', minItems: 1, panaKind: 'double' }],
        separator: ',',
      },
      betPhaseType: 'both',
      rulesVersion: 1,
    });

    await placeBetsFromRequest({
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt_motor',
      bets: [{ value: { panas: ['112', '113', '122', '133', '223', '233'] }, amount: 100, betMode: 'open' }],
    });

    expect(mocks.betRepository.createBet).toHaveBeenCalledWith(
      expect.objectContaining({
        gameTypeCodeSnapshot: 'DP_MOTOR',
        gameTypeTemplateKey: 'DP_MOTOR',
        selection: '112,113,122,133,223,233',
        generatedPanas: ['112', '113', '122', '133', '223', '233'],
        combinationCount: 6,
        stakePerCombination: 1666.6666666666667,
      }),
      transactionSession,
    );

    expect(mocks.sessionExposureRepository.applyDelta).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session1',
        mode: 'open',
      }),
    );
  });

  test('rejects non-canonical SP_MOTOR panas instead of auto-correcting them', async () => {
    mocks.gameTypeRepository.findById.mockResolvedValue({
      _id: 'gt_motor',
      code: 'SP_MOTOR',
      templateKey: 'SP_MOTOR',
      payoutMultiplier: 120,
      rules: {
        allowedBetModes: ['open', 'close'],
        parts: [{ name: 'panas', type: 'pana_set', minItems: 1, panaKind: 'single' }],
        separator: ',',
      },
      betPhaseType: 'both',
      rulesVersion: 1,
    });

    await expect(placeBetsFromRequest({
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt_motor',
      bets: [{ value: { panas: ['012'] }, amount: 100, betMode: 'open' }],
    })).rejects.toThrow('Part panas must contain unique single panas (1-any)');

    expect(mocks.betRepository.createBet).not.toHaveBeenCalled();
  });

  test('uses runtime SP_MOTOR template rules even if persisted gameType rules are stale', async () => {
    mocks.gameTypeRepository.findById.mockResolvedValue({
      _id: 'gt_motor',
      code: 'SP_MOTOR',
      templateKey: 'SP_MOTOR',
      payoutMultiplier: 120,
      rules: {
        allowedBetModes: ['open', 'close'],
        parts: [{ name: 'digits', type: 'digit_set', minItems: 3, maxItems: 7 }],
        separator: ',',
      },
      betPhaseType: 'both',
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
        gameTypeId: 'gt_motor',
        code: 'SP_MOTOR',
        name: 'SP Motor',
        betPhaseType: 'both',
        payoutMultiplier: 120,
        minBet: 1,
        maxBet: 1000,
        status: 'active',
      }],
    });

    await expect(placeBetsFromRequest({
      userId: 'user1',
      sessionId: 'session1',
      gameTypeId: 'gt_motor',
      bets: [{ value: { panas: ['123', '125', '135'] }, amount: 5, betMode: 'close' }],
    })).resolves.toEqual(expect.objectContaining({
      totalBets: 1,
      totalAmount: 5,
      balance: 5000,
    }));

    expect(mocks.betRepository.createBet).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: '123,125,135',
        generatedPanas: ['123', '125', '135'],
        betMode: 'close',
      }),
      transactionSession,
    );
  });
});
