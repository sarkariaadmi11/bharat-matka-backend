const crypto = require('crypto');

describe('Payment verification safety', () => {
  let paymentService;
  let mocks;
  let httpsHandlers;

  const createSession = () => ({
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn(),
  });

  beforeEach(() => {
    jest.resetModules();
    httpsHandlers = {};
    mocks = {
      paymentRepository: {
        findByOrderId: jest.fn(),
        create: jest.fn(),
      },
      walletRepository: {
        findByUserId: jest.fn(),
        creditBalance: jest.fn(),
        debitBalance: jest.fn(),
      },
      payoutRepository: {
        findByIdempotencyKey: jest.fn(),
        findOne: jest.fn(),
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

    jest.doMock('@config', () => ({
      RAZORPAY_KEY_SECRET: 'test_secret',
      RAZORPAY_KEY_ID: 'test_key',
      RAZORPAY_WEBHOOK_SECRET: 'whsec',
    }));

    jest.doMock('https', () => ({
      request: jest.fn((_url, _options, callback) => {
        const response = {
          statusCode: 200,
          on: (event, handler) => {
            httpsHandlers[event] = handler;
          },
        };

        callback(response);

        return {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(() => {
            if (httpsHandlers.data) {
              httpsHandlers.data(JSON.stringify({
                id: 'pay_456',
                order_id: 'order_123',
                status: 'captured',
                method: 'upi',
              }));
            }
            if (httpsHandlers.end) {
              httpsHandlers.end();
            }
          }),
        };
      }),
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

  test('verifies Razorpay signature deterministically', () => {
    // Arrange
    const payload = {
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_456',
    };
    const signature = crypto
      .createHmac('sha256', 'test_secret')
      .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
      .digest('hex');

    // Act
    const isValid = paymentService.verifyPaymentSignature({
      ...payload,
      razorpay_signature: signature,
    });

    // Assert
    expect(isValid).toBe(true);
  });

  test('rejects manual payment verification on invalid signature', async () => {
    // Arrange
    const request = {
      userId: 'user_1',
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_456',
      razorpay_signature: 'bad_signature',
    };

    // Act / Assert
    await expect(paymentService.verifyDepositPayment(request)).rejects.toThrow('Invalid signature');
  });

  test('returns latest wallet balance when payment was already processed before verify call', async () => {
    const payment = {
      _id: 'payment-1',
      userId: 'user_1',
      provider: 'razorpay',
      amount: 15000,
      currency: 'INR',
      transactionType: 'deposit',
      referenceId: 'ORDER_REF_1',
      paymentReference: 'order_123',
      razorpayOrderId: 'order_123',
      status: 'success',
      verificationStatus: 'verified',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const signature = crypto
      .createHmac('sha256', 'test_secret')
      .update('order_123|pay_456')
      .digest('hex');

    mocks.paymentRepository.findByOrderId
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce(payment);
    mocks.walletRepository.findByUserId.mockResolvedValue({ balance: 45000 });

    const result = await paymentService.verifyDepositPayment({
      userId: 'user_1',
      razorpay_order_id: 'order_123',
      razorpay_payment_id: 'pay_456',
      razorpay_signature: signature,
    });

    expect(result).toEqual(expect.objectContaining({
      alreadyProcessed: true,
      balance: 450,
      walletBalance: 450,
      payment: expect.objectContaining({
        id: 'payment-1',
        userId: 'user_1',
        provider: 'razorpay',
        amount: 150,
        currency: 'INR',
        transactionType: 'deposit',
        paymentReference: 'order_123',
        status: 'success',
        verificationStatus: 'verified',
      }),
    }));
    expect(mocks.walletRepository.findByUserId).toHaveBeenCalledWith('user_1', mocks.session);
    expect(mocks.walletRepository.creditBalance).not.toHaveBeenCalled();
    expect(mocks.globalConfigRepository.getOrCreateActiveConfig).not.toHaveBeenCalled();
  });
});
