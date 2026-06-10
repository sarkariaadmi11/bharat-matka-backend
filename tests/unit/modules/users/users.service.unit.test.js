describe('users.service history and wallet', () => {
  let usersService;
  let mocks;

  const loadServiceWithMocks = () => {
    jest.resetModules();

    mocks = {
      userRepository: { model: {} },
      walletRepository: {},
      transactionRepository: {
        getUserLedger: jest.fn(),
        findWinCreditsForDebitTransactions: jest.fn(),
      },
      paymentRepository: {
        getUserDepositHistory: jest.fn(),
      },
      payoutRepository: {
        getUserWithdrawalHistory: jest.fn(),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            User: mocks.userRepository,
            Wallet: mocks.walletRepository,
            Transaction: mocks.transactionRepository,
            Payment: mocks.paymentRepository,
            Payout: mocks.payoutRepository,
          };
          return repoMap[name];
        },
      },
    }));

    usersService = require('@modules/users/users.service');
  };

  beforeEach(() => {
    loadServiceWithMocks();
  });

  test('includes session and market context for win-credit transactions', async () => {
    mocks.transactionRepository.getUserLedger.mockResolvedValue({
      transactions: [
        {
          _id: 'tx-1',
          type: 'WIN_CREDIT',
          amount: 9000,
          winAmount: 9000,
          balanceAfter: 12000,
          sessionId: {
            _id: 'session-1',
            marketId: {
              code: 'MK1',
              name: 'Mock Market',
            },
          },
          marketCode: null,
          gameTypeCode: 'SP_MOTOR',
          betMode: 'close',
          selections: ['123,125,135'],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      pagination: { total: 1 },
    });

    const result = await usersService.getTransactionHistory('user-1', 1, 20);

    expect(result).toEqual({
      items: [
        expect.objectContaining({
          type: 'WIN_CREDIT',
          amount: 90,
          winAmount: 90,
          balanceAfter: 120,
          sessionId: 'session-1',
          market: 'MK1',
          marketName: 'Mock Market',
          gameType: 'SP_MOTOR',
          betMode: 'close',
          selections: ['123,125,135'],
          betResult: 'won',
          settlementStatus: 'settled',
          creditedWinAmount: 90,
        }),
      ],
      total: 1,
    });
  });

  test('backfills win-credit context from linked bets when transaction snapshot fields are missing', async () => {
    mocks.transactionRepository.getUserLedger.mockResolvedValue({
      transactions: [
        {
          _id: 'tx-user-1',
          type: 'WIN_CREDIT',
          amount: 9500,
          winAmount: 9500,
          balanceAfter: 998550,
          sessionId: null,
          marketCode: null,
          gameTypeCode: null,
          betMode: null,
          selections: [],
          betIds: [
            {
              _id: 'bet-1',
              selection: '128',
              betMode: 'open',
              gameTypeCodeSnapshot: 'SP',
              sessionId: {
                _id: 'session-user-1',
                marketId: {
                  code: 'KALYAN',
                  name: 'Kalyan Day',
                },
              },
            },
          ],
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
      pagination: { total: 1 },
    });

    const result = await usersService.getTransactionHistory('user-1', 1, 20);

    expect(result.items[0]).toEqual(expect.objectContaining({
      type: 'WIN_CREDIT',
      amount: 95,
      winAmount: 95,
      balanceAfter: 9985.5,
      sessionId: 'session-user-1',
      market: 'KALYAN',
      marketName: 'Kalyan Day',
      gameType: 'SP',
      betMode: 'open',
      selections: ['128'],
      betResult: 'won',
      settlementStatus: 'settled',
      creditedWinAmount: 95,
    }));
  });

  test('derives debit settlement context from linked win credits and bet statuses', async () => {
    mocks.transactionRepository.getUserLedger.mockResolvedValue({
      transactions: [
        {
          _id: 'tx-debit-1',
          type: 'BET_DEBIT',
          amount: -1000,
          balanceAfter: 5000,
          betCount: 2,
          betResult: 'pending',
          sessionId: {
            _id: 'session-1',
            marketId: {
              code: 'MK1',
              name: 'Mock Market',
            },
          },
          gameTypeCode: 'JODI',
          betMode: 'open',
          selections: ['59', '61'],
          betIds: [
            {
              _id: 'bet-win-1',
              selection: '59',
              betMode: 'open',
              status: 'won',
              updatedAt: new Date('2026-01-05T00:00:00.000Z'),
              sessionId: {
                _id: 'session-1',
                marketId: {
                  code: 'MK1',
                  name: 'Mock Market',
                },
              },
              gameTypeId: { code: 'JODI' },
            },
            {
              _id: 'bet-lose-1',
              selection: '61',
              betMode: 'open',
              status: 'lost',
              updatedAt: new Date('2026-01-05T00:05:00.000Z'),
              sessionId: {
                _id: 'session-1',
                marketId: {
                  code: 'MK1',
                  name: 'Mock Market',
                },
              },
              gameTypeId: { code: 'JODI' },
            },
          ],
          createdAt: new Date('2026-01-04T23:00:00.000Z'),
        },
      ],
      pagination: { total: 1 },
    });

    mocks.transactionRepository.findWinCreditsForDebitTransactions.mockResolvedValue([
      {
        _id: 'tx-credit-1',
        type: 'WIN_CREDIT',
        amount: 9000,
        relatedTransactionId: 'tx-debit-1',
        betIds: ['bet-win-1'],
        createdAt: new Date('2026-01-05T00:10:00.000Z'),
      },
    ]);

    const result = await usersService.getTransactionHistory('user-1', 1, 20);

    expect(result.items[0]).toEqual(expect.objectContaining({
      type: 'BET_DEBIT',
      amount: 10,
      market: 'MK1',
      marketName: 'Mock Market',
      gameType: 'JODI',
      betMode: 'open',
      selections: ['59', '61'],
      betResult: 'mixed',
      settlementStatus: 'settled',
      creditedWinAmount: 90,
      relatedTransactionId: 'tx-credit-1',
      settledAt: '2026-01-05T00:10:00.000Z',
    }));
  });

  test('returns wallet summary in rupee for self wallet endpoint', async () => {
    mocks.walletRepository.findByUserId = jest.fn().mockResolvedValue({
      balance: 650,
      exposure: 50,
      bonus: 10,
      currency: 'INR',
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    });

    const result = await usersService.getWalletSummary('user-1');

    expect(result).toEqual({
      balance: 6.5,
      exposure: 0.5,
      bonus: 0.1,
      currency: 'INR',
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    });
  });

  test('maps deposit history to public DTO and preserves metadata', async () => {
    mocks.paymentRepository.getUserDepositHistory.mockResolvedValue({
      documents: [
        {
          _id: 'deposit-2',
          provider: 'upi_intent',
          amount: 12345,
          currency: 'INR',
          status: 'success',
          verificationStatus: 'verified',
          paymentReference: 'pay_ref_2',
          clientStatus: 'SUCCESS',
          creditedAt: new Date('2026-04-01T11:00:00.000Z'),
          paidAt: new Date('2026-04-01T10:59:00.000Z'),
          failedAt: null,
          createdAt: new Date('2026-04-01T10:00:00.000Z'),
          updatedAt: new Date('2026-04-01T11:00:00.000Z'),
        },
        {
          _id: 'deposit-1',
          provider: 'razorpay',
          amount: 5000,
          currency: 'INR',
          status: 'pending',
          verificationStatus: 'pending',
          paymentReference: 'pay_ref_1',
          clientStatus: null,
          creditedAt: null,
          paidAt: null,
          failedAt: null,
          createdAt: new Date('2026-04-01T10:00:00.000Z'),
          updatedAt: new Date('2026-04-01T10:01:00.000Z'),
          referenceId: 'internal_ref_should_not_leak',
        },
      ],
      meta: { page: 1, limit: 20, total: 2 },
    });

    const query = {
      page: 1,
      limit: 20,
      status: 'success',
      provider: 'upi_intent',
      fromDate: new Date('2026-04-01T00:00:00.000Z'),
      toDate: new Date('2026-04-30T23:59:59.999Z'),
    };

    const result = await usersService.getDepositHistory('user-1', query);

    expect(mocks.paymentRepository.getUserDepositHistory).toHaveBeenCalledWith('user-1', query);
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: 'deposit-2',
          provider: 'upi_intent',
          amount: 123.45,
          currency: 'INR',
          status: 'success',
          verificationStatus: 'verified',
          paymentReference: 'pay_ref_2',
          clientStatus: 'SUCCESS',
          credited: true,
        }),
        expect.objectContaining({
          id: 'deposit-1',
          provider: 'razorpay',
          amount: 50,
          credited: false,
        }),
      ],
      meta: { page: 1, limit: 20, total: 2 },
    });
    expect(result.data[1].referenceId).toBeUndefined();
  });

  test('maps withdrawal history with masked beneficiary fields', async () => {
    mocks.payoutRepository.getUserWithdrawalHistory.mockResolvedValue({
      documents: [
        {
          _id: 'withdrawal-1',
          provider: 'manual_withdrawal',
          amount: 7800,
          currency: 'INR',
          method: 'bank',
          status: 'pending',
          beneficiary: {
            accountHolderName: 'Demo User',
            bankName: 'State Bank of India',
            bankAccount: '1234567890',
            upiId: 'johnuser@okhdfcbank',
            bankDetailId: 'internal_id_should_not_leak',
            ifsc: 'SBIN0001234',
          },
          reference: 'internal_reference',
          idempotencyKey: 'internal_idempotency_key',
          failureReason: null,
          adminRemarks: null,
          processedAt: null,
          reversedAt: null,
          createdAt: new Date('2026-04-01T10:00:00.000Z'),
          updatedAt: new Date('2026-04-01T10:00:30.000Z'),
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });

    const query = {
      page: 1,
      limit: 20,
      status: 'pending',
      method: 'bank',
      fromDate: new Date('2026-04-01T00:00:00.000Z'),
      toDate: new Date('2026-04-30T23:59:59.999Z'),
    };

    const result = await usersService.getWithdrawalHistory('user-1', query);

    expect(mocks.payoutRepository.getUserWithdrawalHistory).toHaveBeenCalledWith('user-1', query);
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          id: 'withdrawal-1',
          provider: 'manual_withdrawal',
          amount: 78,
          method: 'bank',
          status: 'pending',
          beneficiary: {
            accountHolderName: 'Demo User',
            bankName: 'State Bank of India',
            maskedBankAccount: 'XXXX7890',
            maskedUpiId: 'jo***@okhdfcbank',
          },
        }),
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
    expect(result.data[0].reference).toBeUndefined();
    expect(result.data[0].idempotencyKey).toBeUndefined();
    expect(result.data[0].beneficiary.bankDetailId).toBeUndefined();
    expect(result.data[0].beneficiary.ifsc).toBeUndefined();
  });
});
