describe('wallet.bank.service UPI account flow', () => {
  let walletBankService;
  let mocks;

  beforeEach(() => {
    jest.resetModules();

    mocks = {
      bankDetailRepository: {
        countBankAccountsByUserId: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        findByUserId: jest.fn(),
        findBankAccountsByUserId: jest.fn(),
        findPrimaryByUserId: jest.fn(),
        findPreferredUpiByUserId: jest.fn(),
        deleteByUserAndId: jest.fn(),
      },
      payoutRepository: {
        countPendingByBankDetail: jest.fn(),
      },
    };

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          const repoMap = {
            BankDetail: mocks.bankDetailRepository,
            Payout: mocks.payoutRepository,
          };

          return repoMap[name];
        },
      },
    }));

    walletBankService = require('@modules/wallet/wallet.bank.service');
  });

  test('returns null when user has no saved UPI account', async () => {
    mocks.bankDetailRepository.findPreferredUpiByUserId.mockResolvedValue(null);
    mocks.bankDetailRepository.findPrimaryByUserId.mockResolvedValue(null);

    const result = await walletBankService.getUserUpiAccount('user-1');

    expect(result).toBeNull();
  });

  test('updates existing preferred UPI account', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const existing = {
      _id: 'bank-1',
      userId: 'user-1',
      accountHolderName: 'Old Name',
      upiId: 'old@upi',
      isDefault: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      toObject() {
        return {
          _id: this._id,
          userId: this.userId,
          accountHolderName: this.accountHolderName,
          upiId: this.upiId,
          isDefault: this.isDefault,
          createdAt: this.createdAt,
          updatedAt: this.updatedAt,
        };
      },
      save,
    };

    mocks.bankDetailRepository.findPreferredUpiByUserId.mockResolvedValue(existing);

    const result = await walletBankService.upsertUserUpiAccount('user-1', {
      accountHolderName: 'New Name',
      upiId: 'new@upi',
      isPrimary: true,
    });

    expect(mocks.bankDetailRepository.updateMany).toHaveBeenCalledWith(
      { userId: 'user-1' },
      { isDefault: false },
    );
    expect(save).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      id: 'bank-1',
      accountHolderName: 'New Name',
      upiId: 'new@upi',
      isPrimary: true,
      bankAccountId: 'bank-1',
    }));
  });

  test('creates UPI-only account when user has no payout detail yet', async () => {
    mocks.bankDetailRepository.findPreferredUpiByUserId.mockResolvedValue(null);
    mocks.bankDetailRepository.findPrimaryByUserId.mockResolvedValue(null);
    mocks.bankDetailRepository.create.mockResolvedValue({
      _id: 'bank-2',
      userId: 'user-1',
      accountHolderName: 'Demo User',
      upiId: 'demo@upi',
      isDefault: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await walletBankService.upsertUserUpiAccount('user-1', {
      accountHolderName: 'Demo User',
      upiId: 'demo@upi',
    });

    expect(mocks.bankDetailRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      accountHolderName: 'Demo User',
      bankName: null,
      accountNumber: null,
      ifscCode: null,
      upiId: 'demo@upi',
      isDefault: true,
    }));
    expect(result).toEqual(expect.objectContaining({
      id: 'bank-2',
      upiId: 'demo@upi',
      bankAccountId: 'bank-2',
    }));
  });

  test('lists only bank accounts and excludes UPI-only payout records', async () => {
    mocks.bankDetailRepository.findBankAccountsByUserId.mockResolvedValue([
      {
        _id: 'bank-1',
        userId: 'user-1',
        accountHolderName: 'Bank User',
        bankName: 'Demo Bank',
        accountNumber: '1234567890',
        ifscCode: 'HDFC0000123',
        upiId: null,
        isDefault: true,
      },
    ]);

    const result = await walletBankService.listUserBankAccounts('user-1');

    expect(mocks.bankDetailRepository.findBankAccountsByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([
      expect.objectContaining({
        _id: 'bank-1',
        bankName: 'Demo Bank',
        accountNumber: '******7890',
      }),
    ]);
  });

  test('does not count UPI-only records toward the bank account limit', async () => {
    mocks.bankDetailRepository.countBankAccountsByUserId.mockResolvedValue(0);
    mocks.bankDetailRepository.create.mockResolvedValue({
      _id: 'bank-3',
      userId: 'user-1',
      accountHolderName: 'Demo User',
      bankName: 'Axis Bank',
      accountNumber: '123456789012',
      ifscCode: 'UTIB0000123',
      upiId: null,
      isDefault: true,
    });

    const result = await walletBankService.createBankAccount('user-1', {
      accountHolderName: 'Demo User',
      bankName: 'Axis Bank',
      accountNumber: '123456789012',
      ifscCode: 'UTIB0000123',
    });

    expect(mocks.bankDetailRepository.countBankAccountsByUserId).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(expect.objectContaining({
      _id: 'bank-3',
      isPrimary: true,
      accountNumber: '********9012',
    }));
  });
});
