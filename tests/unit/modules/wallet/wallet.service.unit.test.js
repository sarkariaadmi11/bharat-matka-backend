describe('wallet.service money serialization', () => {
  let walletService;
  let mocks;

  beforeEach(() => {
    jest.resetModules();

    mocks = {
      walletRepository: {
        findByUserId: jest.fn(),
        creditBalance: jest.fn(),
      },
      transactionRepository: {
        findByFilter: jest.fn(),
        recordAdminAdjustment: jest.fn(),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            Wallet: mocks.walletRepository,
            Transaction: mocks.transactionRepository,
          };

          return repoMap[name];
        },
      },
    }));

    walletService = require('@modules/wallet/wallet.service');
  });

  test('returns wallet summary in rupees', async () => {
    mocks.walletRepository.findByUserId.mockResolvedValue({
      balance: 12345,
      exposure: 500,
      bonus: 0,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await walletService.getWallet('user-1');

    expect(result).toEqual(expect.objectContaining({
      balance: 123.45,
      exposure: 5,
      bonus: 0,
    }));
  });

  test('returns transaction amounts in rupees', async () => {
    mocks.transactionRepository.findByFilter.mockResolvedValue({
      documents: [
        {
          _id: 'tx-1',
          amount: -1500,
          balanceAfter: 12345,
          winAmount: 4500,
        },
      ],
      pagination: { total: 1 },
    });

    const result = await walletService.getTransactions('user-1', 1, 20);

    expect(result).toEqual({
      documents: [
        expect.objectContaining({
          amount: 15,
          balanceAfter: 123.45,
          winAmount: 45,
        }),
      ],
      pagination: { total: 1 },
    });
  });
});
