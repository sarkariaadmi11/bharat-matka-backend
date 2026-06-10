describe('UPI deposit flow', () => {
  let paymentService;
  let mocks;

  const createSession = () => ({
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn(),
  });

  const createDepositDoc = (overrides = {}) => ({
    _id: overrides._id || '507f1f77bcf86cd799439011',
    userId: overrides.userId || 'user-1',
    provider: overrides.provider || 'upi_intent',
    transactionType: 'deposit',
    amount: overrides.amount ?? 15000,
    currency: 'INR',
    merchantTxnId: overrides.merchantTxnId || 'UPI_TEST_REF',
    referenceId: overrides.referenceId || 'UPI_TEST_REF',
    status: overrides.status || 'pending',
    verificationStatus: overrides.verificationStatus || 'pending',
    clientStatus: overrides.clientStatus || null,
    upiTxnRef: overrides.upiTxnRef,
    upiApprovalRefNo: overrides.upiApprovalRefNo,
    upiTransactionId: overrides.upiTransactionId,
    creditedAt: overrides.creditedAt || null,
    failedAt: overrides.failedAt || null,
    createdAt: overrides.createdAt || new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: overrides.updatedAt || new Date('2026-01-01T00:00:00.000Z'),
    meta: overrides.meta || {},
    save: jest.fn().mockImplementation(async function save() {
      this.updatedAt = new Date('2026-01-01T00:10:00.000Z');
      return this;
    }),
  });

  beforeEach(() => {
    jest.resetModules();

    mocks = {
      paymentRepository: {
        create: jest.fn(),
        findByOrderId: jest.fn(),
        findDepositByIdAndUser: jest.fn(),
        findDuplicateUpiReference: jest.fn(),
        claimUpiDepositForCredit: jest.fn(),
        findByIdempotencyKey: jest.fn(),
        findOne: jest.fn(),
        findByFilter: jest.fn(),
      },
      walletRepository: {
        creditBalance: jest.fn(),
        debitBalance: jest.fn(),
        findByUserId: jest.fn(),
      },
      payoutRepository: {
        findByIdempotencyKey: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        findForAdmin: jest.fn(),
      },
      transactionRepository: {
        recordDeposit: jest.fn(),
        recordWithdrawalDebit: jest.fn(),
        findByFilter: jest.fn(),
      },
      bankDetailRepository: {
        findByUserAndId: jest.fn(),
      },
      globalConfigRepository: {
        getOrCreateActiveConfig: jest.fn(),
      },
      session: createSession(),
    };

    mocks.globalConfigRepository.getOrCreateActiveConfig.mockResolvedValue({
      upiMerchantId: null,
      minimumDeposit: 100,
      maximumDeposit: 100000,
      minimumWithdrawal: 100,
      maximumWithdrawal: 100000,
      minimumBidAmount: 10,
      maximumBidAmount: 10000,
      welcomeBonus: 5,
      withdrawOpenTime: '09:00',
      withdrawCloseTime: '13:00',
      globalBetting: true,
      resultDeclarationGraceHours: 5,
      save: jest.fn().mockResolvedValue(undefined),
    });

    jest.doMock('@config', () => ({
      RAZORPAY_KEY_SECRET: 'test_secret',
      RAZORPAY_KEY_ID: 'test_key',
      RAZORPAY_WEBHOOK_SECRET: 'whsec',
      UPI_MERCHANT_ID: 'merchant@upi',
      UPI_MERCHANT_NAME: 'Mahadev Matka',
      UPI_MERCHANT_URL: 'https://example.com/payments',
      UPI_VERIFICATION_MODE: 'mock',
      UPI_MOCK_VERIFICATION_RESULT: 'verified',
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

  test('initiates a UPI deposit successfully', async () => {
    const createdDeposit = createDepositDoc({
      _id: '507f1f77bcf86cd799439012',
      amount: 25000,
      merchantTxnId: 'UPI_TEST_INIT',
      referenceId: 'UPI_TEST_INIT',
    });
    mocks.paymentRepository.create.mockResolvedValue(createdDeposit);

    const result = await paymentService.initiateUpiDeposit({
      userId: 'user-1',
      amount: 250,
    });

    expect(mocks.paymentRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      provider: 'upi_intent',
      amount: 25000,
      status: 'pending',
      merchantTxnId: expect.any(String),
    }));
    expect(result).toEqual(expect.objectContaining({
      depositId: '507f1f77bcf86cd799439012',
      amount: 250,
      currency: 'INR',
      merchantTxnId: expect.any(String),
    }));
    expect(result.upi).toEqual(expect.objectContaining({
      pa: 'merchant@upi',
      pn: 'Mahadev Matka',
      tr: result.merchantTxnId,
      am: '250.00',
      cu: 'INR',
      url: 'https://example.com/payments',
      upiUrl: expect.stringContaining('upi://pay?'),
    }));
  });

  test('prefers merchant UPI from global config when configured', async () => {
    mocks.globalConfigRepository.getOrCreateActiveConfig.mockResolvedValue({
      upiMerchantId: '1342011009115@ucobank',
      save: jest.fn().mockResolvedValue(undefined),
    });
    mocks.paymentRepository.create.mockResolvedValue(createDepositDoc({
      _id: '507f1f77bcf86cd799439099',
      amount: 25000,
    }));

    const result = await paymentService.initiateUpiDeposit({
      userId: 'user-1',
      amount: 250,
    });

    expect(result.upi).toEqual(expect.objectContaining({
      pa: '1342011009115@ucobank',
    }));
  });

  test('rejects invalid UPI deposit amount', async () => {
    await expect(paymentService.initiateUpiDeposit({
      userId: 'user-1',
      amount: 0,
    })).rejects.toThrow('Amount must be greater than 0');
  });

  test('credits wallet immediately on success callback', async () => {
    const initialDeposit = createDepositDoc({
      upiTxnRef: undefined,
      upiApprovalRefNo: undefined,
      upiTransactionId: undefined,
    });

    mocks.paymentRepository.findDepositByIdAndUser.mockResolvedValue(initialDeposit);
    mocks.paymentRepository.findDuplicateUpiReference.mockResolvedValue(null);
    mocks.walletRepository.creditBalance.mockResolvedValue({ balance: 65000 });

    const result = await paymentService.submitUpiCallback({
      userId: 'user-1',
      depositId: '507f1f77bcf86cd799439011',
      statusFromClient: 'SUCCESS',
      txnRef: 'TXN_REF_1',
      approvalRefNo: 'APR_1',
      transactionId: 'UPI_TXN_1',
      responseCode: '00',
      rawResponse: { Status: 'SUCCESS' },
    });

    expect(mocks.walletRepository.creditBalance).toHaveBeenCalled();
    expect(mocks.transactionRepository.recordDeposit).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'success',
      verificationStatus: 'verified',
      credited: true,
      amount: 150,
    }));
  });

  test('marks deposit failed on client failure callback', async () => {
    const deposit = createDepositDoc();
    mocks.paymentRepository.findDepositByIdAndUser.mockResolvedValue(deposit);
    mocks.paymentRepository.findDuplicateUpiReference.mockResolvedValue(null);

    const result = await paymentService.submitUpiCallback({
      userId: 'user-1',
      depositId: '507f1f77bcf86cd799439011',
      statusFromClient: 'FAILED',
      txnRef: 'TXN_REF_FAIL',
      rawResponse: 'failure',
    });

    expect(mocks.walletRepository.creditBalance).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'failed',
      verificationStatus: 'failed',
      credited: false,
    }));
  });

  test('returns already processed for duplicate callback on credited deposit', async () => {
    const deposit = createDepositDoc({
      status: 'success',
      verificationStatus: 'verified',
      creditedAt: new Date('2026-01-01T00:05:00.000Z'),
    });
    mocks.paymentRepository.findDepositByIdAndUser.mockResolvedValue(deposit);
    mocks.paymentRepository.findDuplicateUpiReference.mockResolvedValue(null);
    mocks.walletRepository.findByUserId.mockResolvedValue({ balance: 65000 });

    const result = await paymentService.submitUpiCallback({
      userId: 'user-1',
      depositId: '507f1f77bcf86cd799439011',
      statusFromClient: 'SUCCESS',
      transactionId: 'UPI_TXN_DUP',
      rawResponse: { repeat: true },
    });

    expect(mocks.walletRepository.creditBalance).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'success',
      credited: true,
      alreadyProcessed: true,
      walletBalance: 650,
    }));
  });

  test('marks deposit failed on non-success client status (PENDING)', async () => {
    const deposit = createDepositDoc();
    mocks.paymentRepository.findDepositByIdAndUser.mockResolvedValue(deposit);
    mocks.paymentRepository.findDuplicateUpiReference.mockResolvedValue(null);

    const result = await paymentService.submitUpiCallback({
      userId: 'user-1',
      depositId: '507f1f77bcf86cd799439011',
      statusFromClient: 'PENDING',
      rawResponse: { Status: 'PENDING' },
    });

    expect(mocks.walletRepository.creditBalance).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      status: 'failed',
      verificationStatus: 'failed',
      credited: false,
    }));
  });

  test('does not expose another users deposit status', async () => {
    mocks.paymentRepository.findDepositByIdAndUser.mockResolvedValue(null);

    await expect(paymentService.getUpiDepositStatus({
      userId: 'user-1',
      depositId: '507f1f77bcf86cd799439011',
    })).rejects.toThrow('Deposit not found');
  });

  test('returns successful deposit status with wallet balance in rupees', async () => {
    mocks.paymentRepository.findDepositByIdAndUser.mockResolvedValue(createDepositDoc({
      status: 'success',
      verificationStatus: 'verified',
      creditedAt: new Date('2026-01-01T00:05:00.000Z'),
    }));
    mocks.walletRepository.findByUserId.mockResolvedValue({ balance: 65000 });

    const result = await paymentService.getUpiDepositStatus({
      userId: 'user-1',
      depositId: '507f1f77bcf86cd799439011',
    });

    expect(result).toEqual(expect.objectContaining({
      amount: 150,
      status: 'success',
      verificationStatus: 'verified',
      credited: true,
      walletBalance: 650,
    }));
  });

  test('returns credited deposit history in rupees', async () => {
    mocks.transactionRepository.findByFilter.mockResolvedValue({
      documents: [
        {
          _id: 'tx-deposit-1',
          amount: 15000,
          balanceAfter: 65000,
          referenceId: 'payment-1',
          meta: {
            provider: 'upi_intent',
            merchantTxnId: 'UPI_MERCHANT_1',
          },
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });

    const result = await paymentService.getDepositHistory({
      userId: 'user-1',
      page: 1,
      limit: 20,
    });

    expect(mocks.transactionRepository.findByFilter).toHaveBeenCalledWith(
      { userId: 'user-1', type: 'DEPOSIT', status: { $ne: 'pending' } },
      1,
      20,
    );
    expect(result).toEqual({
      documents: [
        expect.objectContaining({
          amount: 150,
          balanceAfter: 650,
          provider: 'upi_intent',
          paymentReference: 'UPI_MERCHANT_1',
        }),
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });
  });
});
