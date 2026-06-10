describe('adminUser.service money serialization', () => {
  let adminUserService;
  let mocks;

  beforeEach(() => {
    jest.resetModules();

    mocks = {
      userRepository: {
        findAdminDetailsById: jest.fn(),
        findForAdminList: jest.fn(),
        setStatus: jest.fn(),
      },
      walletRepository: {
        getExposureSummaryByUserId: jest.fn(),
      },
      betRepository: {
        getUserBetStats: jest.fn(),
      },
      bankDetailRepository: {
        findByUserId: jest.fn(),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            User: mocks.userRepository,
            Wallet: mocks.walletRepository,
            Bet: mocks.betRepository,
            BankDetail: mocks.bankDetailRepository,
          };

          return repoMap[name];
        },
      },
    }));

    adminUserService = require('@modules/admin/users/adminUser.service');
  });

  test('returns admin user wallet amounts in rupees', async () => {
    mocks.userRepository.findAdminDetailsById.mockResolvedValue({
      _id: 'user-1',
      username: 'demo',
      phone: '9999999999',
      email: null,
      status: 'active',
      role: { code: 'USER' },
      isVerified: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    mocks.walletRepository.getExposureSummaryByUserId.mockResolvedValue({
      balance: 250000,
      exposure: 50000,
      bonus: 0,
      currency: 'INR',
    });
    mocks.betRepository.getUserBetStats.mockResolvedValue({
      totalBets: 0,
      totalWagered: 0,
      totalWinnings: 0,
      totalLosses: 0,
    });
    mocks.bankDetailRepository.findByUserId.mockResolvedValue([]);

    const result = await adminUserService.getUserDetails('user-1');

    expect(result.wallet).toEqual({
      balance: 2500,
      exposure: 500,
      bonus: 0,
      currency: 'INR',
    });
    expect(result.stats).toEqual({
      totalBets: 0,
      totalWagered: 0,
      totalWinnings: 0,
      totalLosses: 0,
      netProfitLoss: 0,
    });
  });

  test('returns admin user stats in rupees', async () => {
    mocks.userRepository.findAdminDetailsById.mockResolvedValue({
      _id: 'user-1',
    });
    mocks.betRepository.getUserBetStats.mockResolvedValue({
      totalBets: 12,
      totalWagered: 450000,
      totalWinnings: 520000,
      totalLosses: 180000,
    });

    const result = await adminUserService.getUserStats('user-1');

    expect(result).toEqual({
      totalBets: 12,
      totalWagered: 4500,
      totalWinnings: 5200,
      totalLosses: 1800,
      netProfitLoss: 3400,
    });
  });
});

describe('adminUser.service bet management contract', () => {
  let adminUserService;
  let mocks;

  beforeEach(() => {
    jest.resetModules();

    mocks = {
      userRepository: {
        findAdminDetailsById: jest.fn(),
      },
      betsService: {
        getUserBets: jest.fn(),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            User: mocks.userRepository,
            Wallet: {},
            Bet: {},
            Transaction: {},
            SessionExposure: {},
            GameType: {},
            GameSession: {},
            Market: {},
            BankDetail: {},
            Auth: {},
          };

          return repoMap[name];
        },
      },
    }));

    jest.doMock('@modules/bets/bets.service', () => mocks.betsService);

    adminUserService = require('@modules/admin/users/adminUser.service');
  });

  test('returns stored bet ids for admin edit and delete actions', async () => {
    mocks.userRepository.findAdminDetailsById.mockResolvedValue({ _id: 'user-1' });
    mocks.betsService.getUserBets.mockResolvedValue({
      items: [
        {
          id: '507f1f77bcf86cd799439011_123',
          betId: '507f1f77bcf86cd799439011',
          expansionKey: '123',
          isExpanded: true,
          market: 'KALYAN',
          gameType: 'SP_MOTOR',
          betMode: 'open',
          selection: '123',
          amount: 10,
          totalAmount: 50,
          odds: 120,
          status: 'pending',
          payout: 0,
          placedAt: new Date('2026-03-15T12:00:00.000Z'),
        },
      ],
      total: 1,
    });

    const result = await adminUserService.getUserBets('user-1', {
      page: 1,
      limit: 20,
    });

    expect(mocks.betsService.getUserBets).toHaveBeenCalledWith(
      'user-1',
      1,
      20,
      expect.objectContaining({ page: 1, limit: 20 }),
    );
    expect(result.items[0]).toEqual(expect.objectContaining({
      id: '507f1f77bcf86cd799439011_123',
      rowId: '507f1f77bcf86cd799439011_123',
      betId: '507f1f77bcf86cd799439011',
      displayId: '507f1f77bcf86cd799439011_123',
      expansionKey: '123',
      isExpanded: true,
      totalAmount: 50,
      canEdit: true,
      canDelete: true,
    }));
  });
});

describe('adminUser.service wallet adjustments', () => {
  let adminUserService;
  let mocks;
  let mockSession;

  beforeEach(() => {
    jest.resetModules();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    mocks = {
      userRepository: {
        findAdminDetailsById: jest.fn().mockResolvedValue({ _id: 'user-1' }),
      },
      walletRepository: {
        creditBalance: jest.fn().mockResolvedValue({ balance: 350000, exposure: 10000 }),
        debitBalance: jest.fn(),
        getExposureSummaryByUserId: jest.fn().mockResolvedValue({ balance: 350000, exposure: 10000 }),
      },
      transactionRepository: {
        findByUserTypeAndIdempotencyKey: jest.fn(),
        recordAdminAdjustment: jest.fn().mockResolvedValue({ _id: 'txn-1', balanceAfter: 350000 }),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            User: mocks.userRepository,
            Wallet: mocks.walletRepository,
            Bet: {},
            Transaction: mocks.transactionRepository,
            SessionExposure: {},
            GameType: {},
            GameSession: {},
            Market: {},
            BankDetail: {},
            Auth: {},
          };

          return repoMap[name];
        },
      },
    }));

    jest.doMock('mongoose', () => ({
      startSession: jest.fn().mockResolvedValue(mockSession),
    }));

    adminUserService = require('@modules/admin/users/adminUser.service');
  });

  test('replays the previous wallet adjustment for the same idempotency key and payload', async () => {
    mocks.transactionRepository.findByUserTypeAndIdempotencyKey.mockResolvedValue({
      _id: 'txn-1',
      balanceAfter: 350000,
      payloadHash: require('crypto')
        .createHash('sha256')
        .update(JSON.stringify({
          operation: 'credit',
          amount: 250,
          reason: 'Manual reconciliation',
          note: '',
          referenceSessionId: null,
        }))
        .digest('hex'),
    });

    const result = await adminUserService.adjustFunds({
      userId: 'user-1',
      operation: 'credit',
      amount: 250,
      reason: 'Manual reconciliation',
      idempotencyKey: 'wallet_adj_1',
    });

    expect(mocks.transactionRepository.recordAdminAdjustment).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      replayed: true,
      transactionId: 'txn-1',
      idempotencyKey: 'wallet_adj_1',
      balance: 3500,
    }));
  });
});

describe('adminUser.service expanded motor row edits', () => {
  let adminUserService;
  let mocks;
  let mockSession;
  let storedBet;

  beforeEach(() => {
    jest.resetModules();

    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    storedBet = {
      _id: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439001',
      sessionId: '507f1f77bcf86cd799439021',
      gameTypeId: '507f1f77bcf86cd799439031',
      betMode: 'open',
      selection: '123,124',
      amount: 2000,
      oddsSnapshot: 120,
      status: 'pending',
      payout: 0,
      generatedPanas: ['123', '124'],
      combinationCount: 2,
      stakePerCombination: 1000,
      gameTypeCodeSnapshot: 'SP_MOTOR',
      gameTypeTemplateKey: 'SP_MOTOR',
      gameTypeRulesVersion: 1,
      save: jest.fn().mockResolvedValue(true),
      toObject() {
        return {
          _id: this._id,
          userId: this.userId,
          sessionId: this.sessionId,
          gameTypeId: this.gameTypeId,
          betMode: this.betMode,
          selection: this.selection,
          amount: this.amount,
          oddsSnapshot: this.oddsSnapshot,
          status: this.status,
          payout: this.payout,
          generatedPanas: [...this.generatedPanas],
          combinationCount: this.combinationCount,
          stakePerCombination: this.stakePerCombination,
          motorLineStakesPaise: this.motorLineStakesPaise,
          gameTypeCodeSnapshot: this.gameTypeCodeSnapshot,
          gameTypeTemplateKey: this.gameTypeTemplateKey,
          gameTypeRulesVersion: this.gameTypeRulesVersion,
        };
      },
    };

    mocks = {
      userRepository: {
        findAdminDetailsById: jest.fn().mockResolvedValue({ _id: storedBet.userId }),
      },
      walletRepository: {
        rebalanceForBetEdit: jest.fn().mockResolvedValue({ balance: 8800, exposure: 500 }),
      },
      betRepository: {
        findOneByUserAndId: jest.fn().mockResolvedValue(storedBet),
        createBet: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439099',
          amount: 1500,
          selection: '125',
          status: 'pending',
        }),
      },
      transactionRepository: {
        recordAdminAdjustment: jest.fn().mockResolvedValue({}),
      },
      sessionExposureRepository: {
        applyDelta: jest.fn().mockResolvedValue({}),
      },
      gameTypeRepository: {
        findLeanById: jest.fn().mockResolvedValue({
          _id: storedBet.gameTypeId,
          code: 'SP_MOTOR',
          templateKey: 'SP_MOTOR',
        }),
      },
      gameSessionRepository: {
        findLeanById: jest.fn().mockResolvedValue({
          _id: storedBet.sessionId,
          marketId: '507f1f77bcf86cd799439041',
        }),
      },
      marketRepository: {
        findLeanById: jest.fn().mockResolvedValue({
          _id: '507f1f77bcf86cd799439041',
          code: 'MK1',
        }),
      },
    };

    jest.doMock('mongoose', () => ({
      startSession: jest.fn().mockResolvedValue(mockSession),
    }));

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            User: mocks.userRepository,
            Wallet: mocks.walletRepository,
            Bet: mocks.betRepository,
            Transaction: mocks.transactionRepository,
            SessionExposure: mocks.sessionExposureRepository,
            GameType: mocks.gameTypeRepository,
            GameSession: mocks.gameSessionRepository,
            Market: mocks.marketRepository,
            BankDetail: {},
            Auth: {},
          };

          return repoMap[name];
        },
      },
    }));

    adminUserService = require('@modules/admin/users/adminUser.service');
  });

  test('updates a single expanded motor line stake on the stored bet', async () => {
    const result = await adminUserService.updateUserBet({
      userId: storedBet.userId,
      betId: `${storedBet._id}_123`,
      payload: {
        amount: 15,
      },
      adminUserId: '507f1f77bcf86cd799439051',
    });

    expect(mocks.walletRepository.rebalanceForBetEdit).toHaveBeenCalledWith(
      storedBet.userId,
      500,
      mockSession,
    );
    expect(storedBet.amount).toBe(2500);
    expect(storedBet.stakePerCombination).toBeNull();
    expect(storedBet.motorLineStakesPaise.get('123')).toBe(1500);
    expect(result).toEqual(expect.objectContaining({
      id: `${storedBet._id}_123`,
      betId: storedBet._id,
      expansionKey: '123',
      isExpanded: true,
      amount: 15,
      totalAmount: 25,
      status: 'pending',
    }));
  });
});
