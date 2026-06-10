describe('payment.service withdrawal approvals', () => {
  let paymentService;
  let mocks;

  const createSession = () => ({
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn(),
  });

  beforeEach(() => {
    jest.resetModules();

    mocks = {
      walletRepository: {
        findByUserId: jest.fn(),
        debitBalance: jest.fn(),
      },
      paymentRepository: {},
      payoutRepository: {
        findByIdempotencyKey: jest.fn(),
        create: jest.fn(),
        findOne: jest.fn(),
      },
      transactionRepository: {
        recordWithdrawalDebit: jest.fn(),
        findByFilter: jest.fn(),
      },
      bankDetailRepository: {
        findByUserAndId: jest.fn(),
      },
      globalConfigRepository: {
        getOrCreateActiveConfig: jest.fn().mockResolvedValue({
          minimumDeposit: 100,
          maximumDeposit: 100000,
          minimumWithdrawal: 100,
          maximumWithdrawal: 100000,
          minimumBidAmount: 10,
          maximumBidAmount: 10000,
          welcomeBonus: 5,
          withdrawOpenTime: '00:00',
          withdrawCloseTime: '23:59',
          globalBetting: true,
          resultDeclarationGraceHours: 5,
        }),
      },
      session: createSession(),
    };

    jest.doMock('@config', () => ({
      RAZORPAY_KEY_SECRET: 'test_secret',
      RAZORPAY_KEY_ID: 'test_key',
      RAZORPAY_WEBHOOK_SECRET: 'whsec',
    }));

    jest.doMock('mongoose', () => ({
      startSession: jest.fn(async () => mocks.session),
      Types: {
        ObjectId: {
          isValid: jest.fn(() => true),
        },
      },
    }));

    jest.doMock('@infra/database', () => ({
      RepositoryFactory: {
        getRepository: (name) => {
          switch (name) {
            case 'Wallet':
              return mocks.walletRepository;
            case 'Payment':
              return mocks.paymentRepository;
            case 'Payout':
              return mocks.payoutRepository;
            case 'Transaction':
              return mocks.transactionRepository;
            case 'BankDetail':
              return mocks.bankDetailRepository;
            case 'GlobalConfig':
              return mocks.globalConfigRepository;
            default:
              throw new Error(`Unknown repository ${name}`);
          }
        },
      },
    }));

    paymentService = require('@modules/payments/payment.service');
  });

  test('creates withdrawal request in pending state without debiting wallet', async () => {
    const createdAt = new Date('2026-04-03T10:00:00.000Z');
    const updatedAt = new Date('2026-04-03T10:00:00.000Z');

    mocks.bankDetailRepository.findByUserAndId.mockResolvedValue({
      _id: 'bank-1',
      accountNumber: '1234567890',
      ifscCode: 'SBIN0001234',
      bankName: 'State Bank of India',
      accountHolderName: 'Demo User',
      upiId: null,
    });
    mocks.walletRepository.findByUserId.mockResolvedValue({
      balance: 50000,
    });
    mocks.payoutRepository.create.mockResolvedValue({
      _id: 'payout-1',
      userId: 'user-1',
      provider: 'manual_withdrawal',
      amount: 12000,
      currency: 'INR',
      method: 'bank',
      status: 'pending',
      idempotencyKey: 'wd-key-1',
      reference: 'ORDER_REF_1',
      beneficiary: {
        bankDetailId: 'bank-1',
        bankAccount: '1234567890',
        ifsc: 'SBIN0001234',
        accountHolderName: 'Demo User',
        bankName: 'State Bank of India',
      },
      createdAt,
      updatedAt,
    });

    const result = await paymentService.requestWithdrawal({
      userId: 'user-1',
      amount: 120,
      bankAccountId: 'bank-1',
      idempotencyKey: 'wd-key-1',
    });

    expect(result).toEqual(expect.objectContaining({
      id: 'payout-1',
      userId: 'user-1',
      amount: 120,
      status: 'pending',
      walletBalance: 500,
      canApprove: true,
      canReject: true,
    }));
    expect(mocks.walletRepository.debitBalance).not.toHaveBeenCalled();
    expect(mocks.transactionRepository.recordWithdrawalDebit).not.toHaveBeenCalled();
  });

  test('approves withdrawal, updates status, and debits wallet balance', async () => {
    const payout = {
      _id: 'payout-1',
      userId: 'user-1',
      provider: 'manual_withdrawal',
      amount: 12000,
      currency: 'INR',
      method: 'bank',
      status: 'pending',
      idempotencyKey: 'wd-key-1',
      reference: 'ORDER_REF_1',
      beneficiary: {},
      adminRemarks: null,
      save: jest.fn().mockImplementation(async function save() {
        return this;
      }),
    };

    mocks.payoutRepository.findOne.mockResolvedValue(payout);
    mocks.walletRepository.debitBalance.mockResolvedValue({
      balance: 38000,
    });

    const result = await paymentService.approveWithdrawal({
      payoutId: 'payout-1',
      adminUserId: 'admin-1',
      adminRemarks: 'Approved by admin',
    });

    expect(mocks.walletRepository.debitBalance).toHaveBeenCalledWith('user-1', 12000, mocks.session);
    expect(mocks.transactionRepository.recordWithdrawalDebit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 12000,
        balanceAfter: 38000,
        referenceId: 'payout-1',
      }),
      mocks.session,
    );
    expect(payout.status).toBe('approved');
    expect(payout.adminApprovedBy).toBe('admin-1');
    expect(payout.processedAt).toBeInstanceOf(Date);
    expect(result).toEqual(expect.objectContaining({
      balance: 380,
      payout: expect.objectContaining({
        id: 'payout-1',
        status: 'approved',
        walletBalance: 380,
        canApprove: false,
        canReject: false,
        adminApprovedBy: 'admin-1',
      }),
    }));
  });
});
