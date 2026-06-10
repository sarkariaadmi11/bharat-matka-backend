const {
  DEPOSIT_PROVIDER,
  DEPOSIT_STATUS,
  DEPOSIT_VERIFICATION_STATUS,
  WITHDRAWAL_METHOD,
  WITHDRAWAL_STATUS,
} = require('@config/constants/payments');

/**
 * Swagger Schemas
 * ----------------
 * These schemas describe the EXTERNAL API contract.
 *
 * ⚠️ Important:
 * - All monetary values here are in INR
 * - Internally, the system stores money in PAISE (integer)
 * - Conversion happens in controllers only
 */

module.exports = {
  /* =========================
     USER & AUTH
  ========================== */

  UserPublic: {
    type: 'object',
    description: 'Public user profile (safe for frontend)',
    properties: {
      id: {
        type: 'string',
        example: '65ff1aa616b1f1d2dde0fa82',
      },
      username: {
        type: 'string',
        example: 'johndoe',
      },
      phone: {
        type: 'string',
        example: '9876543210',
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'banned'],
        example: 'active',
      },
      isVerified: {
        type: 'boolean',
        example: true,
      },
      lastLoginAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  AuthResponse: {
    type: 'object',
    description: 'Authentication response',
    properties: {
      user: {
        $ref: '#/components/schemas/UserPublic',
      },
      accessToken: {
        type: 'string',
        description: 'JWT access token with normalized `roles` claims.',
      },
      refreshToken: {
        type: 'string',
        description: 'JWT refresh token',
      },
    },
  },

  AuthRegisterRequest: {
    type: 'object',
    required: ['username', 'phone', 'password', 'confirmPassword'],
    properties: {
      username: {
        type: 'string',
        minLength: 3,
        maxLength: 30,
        example: 'johndoe',
      },
      phone: {
        type: 'string',
        pattern: '^\\d{10}$',
        example: '9876543210',
      },
      password: {
        type: 'string',
        minLength: 6,
        format: 'password',
      },
      confirmPassword: {
        type: 'string',
        minLength: 6,
        format: 'password',
      },
    },
  },

  AuthLoginRequest: {
    type: 'object',
    required: ['phone', 'password'],
    properties: {
      phone: {
        type: 'string',
        pattern: '^\\d{10}$',
        example: '9876543210',
      },
      password: {
        type: 'string',
        minLength: 6,
        format: 'password',
      },
    },
  },

  AuthRefreshTokenRequest: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: {
        type: 'string',
      },
    },
  },

  AuthForgotPasswordRequest: {
    type: 'object',
    required: ['phone'],
    properties: {
      phone: {
        type: 'string',
        pattern: '^\\d{10}$',
        example: '9876543210',
      },
    },
  },

  AuthResetPasswordRequest: {
    type: 'object',
    required: ['resetToken', 'newPassword', 'confirmPassword'],
    properties: {
      resetToken: {
        type: 'string',
      },
      newPassword: {
        type: 'string',
        minLength: 6,
        format: 'password',
      },
      confirmPassword: {
        type: 'string',
        minLength: 6,
        format: 'password',
      },
    },
  },

  AuthChangePasswordRequest: {
    type: 'object',
    required: ['currentPassword', 'newPassword', 'confirmPassword'],
    properties: {
      currentPassword: {
        type: 'string',
        minLength: 6,
        format: 'password',
      },
      newPassword: {
        type: 'string',
        minLength: 6,
        format: 'password',
      },
      confirmPassword: {
        type: 'string',
        minLength: 6,
        format: 'password',
      },
    },
  },

  /* =========================
     WALLET & TRANSACTIONS
  ========================== */

  WalletSummary: {
    type: 'object',
    description: 'User wallet summary (read-only, amounts in rupee)',
    properties: {
      balance: {
        $ref: '#/components/schemas/MoneyINR',
        description: 'Available balance in rupee',
      },
      exposure: {
        $ref: '#/components/schemas/MoneyINR',
        description: 'Amount currently locked in active bets, in rupee',
      },
      bonus: {
        $ref: '#/components/schemas/MoneyINR',
        description: 'Bonus balance in rupee',
      },
      currency: {
        type: 'string',
        example: 'INR',
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  Transaction: {
    type: 'object',
    description: 'Immutable wallet transaction ledger entry',
    properties: {
      id: {
        type: 'string',
      },
      sessionId: {
        type: 'string',
        nullable: true,
        description: 'Related game session ID when the transaction comes from betting or settlement.',
      },
      type: {
        type: 'string',
        enum: ['BET_DEBIT', 'WIN_CREDIT', 'ADMIN_ADJUSTMENT'],
        example: 'BET_DEBIT',
      },
      amount: {
        $ref: '#/components/schemas/MoneyINR',
      },
      balanceAfter: {
        $ref: '#/components/schemas/MoneyINR',
      },
      winAmount: {
        allOf: [{ $ref: '#/components/schemas/MoneyINR' }],
        nullable: true,
        description: 'Winning credit amount in rupee for settlement transactions.',
      },
      referenceId: {
        type: 'string',
        nullable: true,
        description: 'Related bet ID or admin reference',
      },
      transactionContext: {
        $ref: '#/components/schemas/TransactionContext',
      },
      market: {
        type: 'string',
        nullable: true,
        example: 'KALYAN',
        description: 'Market code for bet debit / win credit transactions.',
      },
      marketName: {
        type: 'string',
        nullable: true,
        example: 'Kalyan Day',
      },
      gameType: {
        type: 'string',
        nullable: true,
        example: 'SP_MOTOR',
      },
      betMode: {
        type: 'string',
        enum: ['open', 'close'],
        nullable: true,
      },
      selections: {
        type: 'array',
        nullable: true,
        items: { type: 'string', example: '123' },
      },
      betResult: {
        type: 'string',
        enum: ['pending', 'won', 'lost', 'refunded', 'mixed'],
        nullable: true,
        description: 'Derived settlement result for bet-related ledger entries.',
      },
      settlementStatus: {
        type: 'string',
        enum: ['pending', 'settled'],
        nullable: true,
        description: 'Whether the related bet set has fully resolved.',
      },
      creditedWinAmount: {
        allOf: [{ $ref: '#/components/schemas/MoneyINR' }],
        nullable: true,
        description: 'Total credited win amount in rupee linked to a bet debit entry.',
      },
      settledAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Final settlement timestamp for the related bet lifecycle when available.',
      },
      relatedTransactionId: {
        type: 'string',
        nullable: true,
        description: 'Linked settlement transaction for bet debits, or linked debit transaction for win credits.',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  TransactionContext: {
    type: 'object',
    required: ['source', 'referenceType'],
    properties: {
      source: {
        type: 'string',
        enum: ['admin', 'bet', 'system'],
      },
      referenceType: {
        type: 'string',
        enum: ['ADMIN', 'BET', 'REFUND', 'PAYMENT', 'PAYOUT', 'SETTLEMENT', 'OTHER'],
      },
    },
  },

  /* =========================
     PAYMENTS & WITHDRAWALS
  ========================== */

  DepositOrderCreateRequest: {
    type: 'object',
    required: ['amount'],
    properties: {
      amount: {
        $ref: '#/components/schemas/MoneyINR',
      },
    },
  },

  DepositOrderCreateResponse: {
    type: 'object',
    description: 'Razorpay order details for frontend checkout.',
    properties: {
      paymentId: { type: 'string', example: '65ff1aa616b1f1d2dde0fa82' },
      orderId: { type: 'string', example: 'order_QQJ7jJw8iN0yD4' },
      keyId: { type: 'string', example: 'rzp_test_xxxxx' },
      amount: { $ref: '#/components/schemas/MoneyINR' },
      currency: { type: 'string', example: 'INR' },
      receipt: { type: 'string', example: 'ORDER_1740760500000_a1b2c3d4' },
      status: { type: 'string', enum: ['pending', 'processing', 'success', 'failed'] },
    },
  },

  UpiDepositInitiateResponse: {
    type: 'object',
    properties: {
      depositId: { type: 'string', example: '65ff1aa616b1f1d2dde0fa82' },
      amount: { $ref: '#/components/schemas/MoneyINR' },
      currency: { type: 'string', example: 'INR' },
      merchantTxnId: { type: 'string', example: 'UPI_1740760500000_A1B2C3D4E5F6' },
      upi: {
        type: 'object',
        properties: {
          pa: { type: 'string', example: 'merchant@upi' },
          pn: { type: 'string', example: 'Merchant Name' },
          tr: { type: 'string', example: 'UPI_1740760500000_A1B2C3D4E5F6' },
          tn: { type: 'string', example: 'Wallet top-up UPI_1740760500000_A1B2C3D4E5F6' },
          am: { type: 'string', example: '12.00' },
          cu: { type: 'string', example: 'INR' },
          url: { type: 'string', example: 'https://your-domain.com/payments' },
          upiUrl: { type: 'string', example: 'upi://pay?...' },
        },
      },
    },
  },

  UpiDepositCallbackRequest: {
    type: 'object',
    required: ['depositId', 'statusFromClient'],
    properties: {
      depositId: { type: 'string', example: '65ff1aa616b1f1d2dde0fa82' },
      statusFromClient: { type: 'string', example: 'SUCCESS' },
      txnRef: { type: 'string', nullable: true, example: 'TXN_REF_123' },
      approvalRefNo: { type: 'string', nullable: true, example: 'APR_456' },
      transactionId: { type: 'string', nullable: true, example: 'UPI_TXN_789' },
      responseCode: { type: 'string', nullable: true, example: '00' },
      rawResponse: {
        nullable: true,
        description: 'Raw client-side response from the UPI app.',
      },
    },
  },

  UpiDepositStatus: {
    type: 'object',
    description: 'UPI intent deposit state returned to the client after app resume and status polling. On successful settlement, walletBalance contains the latest wallet amount in rupee, including idempotent already-processed responses.',
    properties: {
      depositId: { type: 'string', example: '65ff1aa616b1f1d2dde0fa82' },
      amount: { $ref: '#/components/schemas/MoneyINR' },
      currency: { type: 'string', example: 'INR' },
      merchantTxnId: { type: 'string', example: 'UPI_1740760500000_A1B2C3D4E5F6' },
      status: {
        type: 'string',
        enum: Object.values(DEPOSIT_STATUS),
        description: 'User-visible deposit state. Frontend should stop polling on success, failed, or manual_review.',
      },
      verificationStatus: {
        type: 'string',
        enum: Object.values(DEPOSIT_VERIFICATION_STATUS),
        description: 'Backend verification stage for the deposit.',
      },
      clientStatus: { type: 'string', nullable: true, example: 'SUCCESS' },
      credited: { type: 'boolean', example: false },
      alreadyProcessed: {
        type: 'boolean',
        example: false,
        description: 'True when the deposit had already been settled before this request. This is still a valid final response.',
      },
      walletBalance: {
        allOf: [{ $ref: '#/components/schemas/MoneyINR' }],
        nullable: true,
        description: 'Latest wallet balance in rupee after successful settlement. Present on success responses, including already-processed success.',
        example: 1500,
      },
      message: { type: 'string', example: 'Payment submitted. Verification is in progress.' },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
      creditedAt: { type: 'string', format: 'date-time', nullable: true },
      failedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  PaymentVerifyRequest: {
    type: 'object',
    required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'],
    properties: {
      razorpay_order_id: { type: 'string', example: 'order_QQJ7jJw8iN0yD4' },
      razorpay_payment_id: { type: 'string', example: 'pay_QQJ98fY3J81sJm' },
      razorpay_signature: { type: 'string', example: '5c6be79f8a4d...' },
    },
  },

  RazorpayWebhookPayload: {
    type: 'object',
    required: ['event', 'payload'],
    properties: {
      event: { type: 'string', example: 'payment.captured' },
      payload: { type: 'object' },
    },
  },

  PaymentRecord: {
    type: 'object',
    properties: {
      id: { type: 'string', example: '65ff1aa616b1f1d2dde0fa82' },
      userId: { type: 'string', example: '65ff1aa616b1f1d2dde0fa99' },
      provider: { type: 'string', enum: Object.values(DEPOSIT_PROVIDER), example: 'razorpay' },
      transactionType: { type: 'string', example: 'deposit' },
      referenceId: { type: 'string', example: 'ORDER_1740760500000_a1b2c3d4' },
      paymentReference: { type: 'string', example: 'order_QQJ7jJw8iN0yD4' },
      razorpayOrderId: { type: 'string', nullable: true, example: 'order_QQJ7jJw8iN0yD4' },
      razorpayPaymentId: { type: 'string', nullable: true, example: 'pay_QQJ98fY3J81sJm' },
      amount: {
        allOf: [{ $ref: '#/components/schemas/MoneyINR' }],
        description: 'Deposit amount in INR.',
        example: 500,
      },
      currency: { type: 'string', example: 'INR' },
      status: { type: 'string', enum: Object.values(DEPOSIT_STATUS) },
      adminRemarks: { type: 'string', nullable: true },
      paidAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  DepositSettlementResult: {
    type: 'object',
    properties: {
      payment: {
        $ref: '#/components/schemas/PaymentRecord',
      },
      balance: {
        allOf: [{ $ref: '#/components/schemas/MoneyINR' }],
        nullable: true,
        description: 'Wallet balance in INR after deposit settlement.',
      },
      walletBalance: {
        allOf: [{ $ref: '#/components/schemas/MoneyINR' }],
        nullable: true,
        description: 'Wallet balance in INR after deposit settlement.',
      },
      alreadyProcessed: {
        type: 'boolean',
        example: false,
      },
    },
  },

  DepositHistoryItem: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      amount: { $ref: '#/components/schemas/MoneyINR' },
      balanceAfter: { $ref: '#/components/schemas/MoneyINR' },
      provider: { type: 'string', nullable: true },
      paymentReference: { type: 'string', nullable: true },
      referenceId: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  Pagination: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 42 },
      totalPages: { type: 'integer', example: 3 },
    },
  },

  PaginatedHistoryMeta: {
    type: 'object',
    properties: {
      page: { type: 'integer', example: 1 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 42 },
    },
  },

  UserDepositHistoryItem: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      provider: { type: 'string', enum: [DEPOSIT_PROVIDER.RAZORPAY, DEPOSIT_PROVIDER.UPI_INTENT] },
      amount: { $ref: '#/components/schemas/MoneyINR' },
      currency: { type: 'string', example: 'INR' },
      status: { type: 'string', enum: Object.values(DEPOSIT_STATUS) },
      verificationStatus: { type: 'string', enum: Object.values(DEPOSIT_VERIFICATION_STATUS), nullable: true },
      paymentReference: { type: 'string', nullable: true },
      clientStatus: { type: 'string', nullable: true },
      credited: { type: 'boolean' },
      paidAt: { type: 'string', format: 'date-time', nullable: true },
      creditedAt: { type: 'string', format: 'date-time', nullable: true },
      failedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  MaskedWithdrawalBeneficiary: {
    type: 'object',
    properties: {
      accountHolderName: { type: 'string', nullable: true },
      bankName: { type: 'string', nullable: true },
      maskedBankAccount: { type: 'string', nullable: true, example: 'XXXX7890' },
      maskedUpiId: { type: 'string', nullable: true, example: 'jo***@okhdfcbank' },
    },
  },

  UserWithdrawalHistoryItem: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      provider: { type: 'string', enum: Object.values(DEPOSIT_PROVIDER), example: 'manual_withdrawal' },
      amount: { $ref: '#/components/schemas/MoneyINR' },
      currency: { type: 'string', example: 'INR' },
      method: { type: 'string', enum: Object.values(WITHDRAWAL_METHOD) },
      status: { type: 'string', enum: Object.values(WITHDRAWAL_STATUS) },
      beneficiary: { $ref: '#/components/schemas/MaskedWithdrawalBeneficiary' },
      failureReason: { type: 'string', nullable: true },
      adminRemarks: { type: 'string', nullable: true },
      processedAt: { type: 'string', format: 'date-time', nullable: true },
      reversedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  UserDepositHistoryResponse: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: '#/components/schemas/UserDepositHistoryItem' },
      },
      meta: { $ref: '#/components/schemas/PaginatedHistoryMeta' },
    },
  },

  UserWithdrawalHistoryResponse: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: '#/components/schemas/UserWithdrawalHistoryItem' },
      },
      meta: { $ref: '#/components/schemas/PaginatedHistoryMeta' },
    },
  },

  BankDetailCreateRequest: {
    type: 'object',
    required: ['accountHolderName', 'bankName', 'accountNumber', 'ifscCode'],
    properties: {
      accountHolderName: { type: 'string', example: 'John Doe' },
      bankName: { type: 'string', example: 'HDFC Bank' },
      accountNumber: { type: 'string', example: '50100123456789' },
      ifscCode: { type: 'string', example: 'HDFC0000123' },
      upiId: { type: 'string', nullable: true, example: 'john@okhdfcbank' },
      isDefault: { type: 'boolean', default: false },
    },
  },

  BankDetail: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      userId: { type: 'string' },
      accountHolderName: { type: 'string' },
      bankName: { type: 'string' },
      accountNumber: { type: 'string', example: '************6789' },
      ifscCode: { type: 'string' },
      upiId: { type: 'string', nullable: true },
      isDefault: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  WalletBankAccountCreateRequest: {
    type: 'object',
    required: ['accountHolderName', 'bankName', 'accountNumber', 'ifscCode'],
    properties: {
      accountHolderName: { type: 'string', example: 'John Doe' },
      bankName: { type: 'string', example: 'HDFC Bank' },
      accountNumber: { type: 'string', example: '50100123456789' },
      ifscCode: { type: 'string', example: 'HDFC0000123' },
      upiId: { type: 'string', nullable: true, example: 'john@okhdfcbank' },
      isPrimary: { type: 'boolean', default: false },
    },
  },

  WalletBankAccount: {
    type: 'object',
    properties: {
      _id: { type: 'string' },
      userId: { type: 'string' },
      accountHolderName: { type: 'string' },
      bankName: { type: 'string' },
      accountNumber: { type: 'string', example: '************6789' },
      ifscCode: { type: 'string' },
      upiId: { type: 'string', nullable: true },
      isDefault: { type: 'boolean' },
      isPrimary: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  WalletUpiAccountRequest: {
    type: 'object',
    required: ['accountHolderName', 'upiId'],
    properties: {
      accountHolderName: { type: 'string', example: 'John Doe' },
      upiId: { type: 'string', example: 'john@okhdfcbank' },
      isPrimary: { type: 'boolean', default: true },
    },
  },

  WalletUpiAccount: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      userId: { type: 'string' },
      bankAccountId: { type: 'string' },
      accountHolderName: { type: 'string', nullable: true },
      upiId: { type: 'string', nullable: true },
      isDefault: { type: 'boolean' },
      isPrimary: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  WithdrawalRequestCreate: {
    type: 'object',
    required: ['amount', 'bankAccountId'],
    properties: {
      amount: {
        $ref: '#/components/schemas/MoneyINR',
      },
      bankAccountId: { type: 'string', example: '65ff1aa616b1f1d2dde0fa11' },
      method: { type: 'string', enum: ['upi', 'bank'], nullable: true, example: 'bank' },
      idempotencyKey: {
        type: 'string',
        description: 'Client-generated key to prevent duplicate withdrawals.',
        example: 'wd_2026_02_19_001',
      },
    },
  },

  Payout: {
    type: 'object',
    description: 'Withdrawal payout record.',
    properties: {
      id: { type: 'string', example: '65ff1aa616b1f1d2dde0fa82' },
      userId: { type: 'string' },
      provider: { type: 'string', enum: Object.values(DEPOSIT_PROVIDER), example: 'manual_withdrawal' },
      amount: {
        allOf: [{ $ref: '#/components/schemas/MoneyINR' }],
        description: 'Payout amount in INR.',
      },
      currency: { type: 'string', example: 'INR' },
      method: { type: 'string', enum: Object.values(WITHDRAWAL_METHOD), example: 'upi' },
      status: {
        type: 'string',
        enum: Object.values(WITHDRAWAL_STATUS),
        example: 'pending',
      },
      idempotencyKey: { type: 'string', example: 'wd_2026_02_19_001' },
      reference: { type: 'string', nullable: true },
      beneficiary: {
        type: 'object',
        properties: {
          bankDetailId: { type: 'string', nullable: true },
          upiId: { type: 'string', nullable: true },
          bankAccount: { type: 'string', nullable: true },
          ifsc: { type: 'string', nullable: true },
          accountHolderName: { type: 'string', nullable: true },
          bankName: { type: 'string', nullable: true },
        },
      },
      failureReason: { type: 'string', nullable: true },
      adminRemarks: { type: 'string', nullable: true },
      adminApprovedBy: { type: 'string', nullable: true },
      adminApprovedAt: { type: 'string', format: 'date-time', nullable: true },
      processedAt: { type: 'string', format: 'date-time', nullable: true },
      reversedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  AdminApprovalActionRequest: {
    type: 'object',
    description: 'Optional admin remarks for approval/rejection actions.',
    properties: {
      adminRemarks: { type: 'string', example: 'Verified with bank statement' },
    },
  },

  /* =========================
     MARKET & GAME CONFIG
  ========================== */

  GameSession: {
    type: 'object',
    description: 'Game session for a specific market and date',
    properties: {
      sessionId: { type: 'string' },
      marketId: { type: 'string' },
      marketName: { type: 'string', nullable: true },
      phase: {
        type: 'string',
        enum: ['open_running', 'close_running', 'market_closed', 'settled'],
      },
      status: {
        type: 'string',
        enum: ['active', 'cancelled', 'settled'],
        nullable: true,
      },
      openTime: { type: 'string', format: 'date-time' },
      closeTime: { type: 'string', format: 'date-time' },
      cancellationReason: { type: 'string', nullable: true },
      cancelledAt: { type: 'string', format: 'date-time', nullable: true },
      cancelledBy: { type: 'string', nullable: true },
      openResultDeclared: { type: 'boolean', nullable: true },
      result: { $ref: '#/components/schemas/SessionResultSnapshot' },
      currentResult: { $ref: '#/components/schemas/SessionResultSnapshot' },
      settledResult: { $ref: '#/components/schemas/SessionResultSnapshot' },
      resultRevision: { type: 'integer', example: 2 },
      settledResultRevision: { type: 'integer', example: 1 },
      settlementStatus: {
        type: 'string',
        enum: ['pending', 'processing', 'completed', 'failed'],
        nullable: true,
      },
      lastSettlementJobId: { type: 'string', nullable: true },
      isFinanciallyConsistent: { type: 'boolean', example: false },
      warning: {
        allOf: [{ $ref: '#/components/schemas/ResultWarning' }],
        nullable: true,
      },
      resultDeclarationAvailableTill: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Deadline for admin result declaration (closeTime + graceHours). Sessions past this time are no longer available for result entry.',
      },
      createdAt: { type: 'string', format: 'date-time', nullable: true },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  SessionResultSnapshot: {
    type: 'object',
    properties: {
      openPana: { type: 'string', nullable: true },
      openDigit: { type: 'integer', nullable: true },
      closePana: { type: 'string', nullable: true },
      closeDigit: { type: 'integer', nullable: true },
      openDeclaredAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      closeDeclaredAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
    },
  },

  ResultWarning: {
    type: 'object',
    required: ['code', 'message', 'severity', 'actionRequired'],
    properties: {
      code: { type: 'string', example: 'RESULT_SETTLEMENT_IN_PROGRESS' },
      message: { type: 'string' },
      severity: { type: 'string', enum: ['low', 'medium', 'high'] },
      actionRequired: { type: 'boolean' },
      recommendedAction: { type: 'string', nullable: true },
      referenceSessionId: { type: 'string', nullable: true },
    },
  },

  GameType: {
    type: 'object',
    description: 'Playable game type for a market',
    properties: {
      id: { type: 'string' },
      code: { type: 'string', example: 'SINGLE' },
      name: { type: 'string', example: 'Single Digit' },
      payoutMultiplier: { type: 'number', example: 9.5 },
      minBet: { type: 'integer', example: 10 },
      maxBet: { type: 'integer', example: 10000 },
      enabled: { type: 'boolean', example: true },
      rules: {
        type: 'object',
        properties: {
          separator: { type: 'string', example: '_' },
          allowedBetModes: {
            type: 'array',
            items: { type: 'string', enum: ['open', 'close'] },
          },
          parts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'digit' },
                length: { type: 'number', example: 1 },
                type: { type: 'string', enum: ['digit', 'pana', 'pana_set', 'digit_set'] },
                minItems: { type: 'integer', nullable: true },
                maxItems: { type: 'integer', nullable: true },
                panaKind: {
                  type: 'string',
                  enum: ['single', 'double', 'triple', 'any'],
                },
              },
            },
          },
        },
      },
    },
  },

  GameRates: {
    type: 'object',
    description: 'Aggregated game rates and global config used by frontend',
    properties: {
      // currencyRate: {
      //   type: 'number',
      //   example: 1,
      //   description: 'Points -> INR conversion rate from GlobalConfig',
      // },
      gameTypes: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/GameType',
        },
      },
    },
  },

  SupportContactSettings: {
    type: 'object',
    description: 'Global support contact details managed by admins',
    properties: {
      whatsappNumber: {
        type: ['string', 'null'],
        pattern: '^\\d{10}$',
        example: '9876543210',
        description: 'WhatsApp number for customer support (10 digits)',
      },
      telegramLink: {
        type: ['string', 'null'],
        pattern: '^@.*',
        example: '@support_handle',
        description: 'Telegram handle for customer support (starts with @)',
      },
      supportEmail: {
        type: ['string', 'null'],
        format: 'email',
        example: 'support@example.com',
        description: 'Email address for customer support',
      },
    },
  },

  SupportContactUpdateRequest: {
    type: 'object',
    minProperties: 1,
    description: 'Fields to update for global support contact settings',
    properties: {
      whatsappNumber: {
        type: ['string', 'null'],
        pattern: '^\\d{10}$',
        description: 'WhatsApp number for customer support (10 digits)',
        example: '9876543210',
      },
      telegramLink: {
        type: ['string', 'null'],
        pattern: '^@.*',
        description: 'Telegram handle for customer support (starts with @)',
        example: '@support_handle',
      },
      supportEmail: {
        type: ['string', 'null'],
        format: 'email',
        description: 'Email address for customer support',
        example: 'support@example.com',
      },
    },
  },

  Market: {
    type: 'object',
    description: 'Betting market definition',
    properties: {
      id: {
        type: 'string',
      },
      code: {
        type: 'string',
        example: 'KALYAN',
      },
      name: {
        type: 'string',
        example: 'Kalyan Day',
      },
      description: {
        type: 'string',
        nullable: true,
        example: 'Primary day market',
      },
      sessionid: {
        type: 'string',
      },
      resultDisplay: {
        type: 'string',
        example: '***-**-***',
        description: 'Frontend-ready result display string',
      },
      status: {
        type: 'string',
        enum: ['open_running', 'close_running', 'market_closed', 'settled'],
      },
      openTime: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      closeTime: {
        type: 'string',
        format: 'date-time',
        nullable: true,
      },
      gameTypes: {
        type: 'array',
        items: {
          $ref: '#/components/schemas/GameType',
        },
      },
    },
  },

  AdminMarketItem: {
    type: 'object',
    description: 'Admin market list item with today\'s session and result',
    properties: {
      marketId: { type: 'string', example: '69f244db2af25ddb9910d075' },
      name: { type: 'string', example: 'Bharat Morning' },
      code: { type: 'string', example: 'BHARAT_MORNING' },
      openTime: { type: 'string', example: '09:30' },
      closeTime: { type: 'string', example: '10:00' },
      schedule: {
        type: 'object',
        example: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
      },
      session: {
        type: 'object',
        nullable: true,
        properties: {
          id: { type: 'string', example: '6a1a21b483d9b604254a0de3' },
          phase: { type: 'string', enum: ['open_running', 'close_running', 'market_closed', 'settled'] },
          status: { type: 'string', enum: ['active', 'cancelled', 'settled'] },
          openTime: { type: 'string', example: '09:30:00' },
          closeTime: { type: 'string', example: '10:00:00' },
          isOpen: { type: 'boolean', example: true },
        },
      },
      result: {
        type: 'object',
        nullable: true,
        properties: {
          openPana: { type: 'string', nullable: true, example: null },
          openDigit: { type: 'integer', nullable: true, example: null },
          closePana: { type: 'string', nullable: true, example: null },
          closeDigit: { type: 'integer', nullable: true, example: null },
        },
      },
    },
  },

  AdminMarketGameTypes: {
    type: 'object',
    description: 'Game types configured for a specific market',
    properties: {
      marketId: { type: 'string' },
      marketCode: { type: 'string' },
      marketName: { type: 'string' },
      gameTypes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            gameTypeId: { type: 'string' },
            code: { type: 'string' },
            name: { type: 'string' },
            betPhaseType: { type: 'string', enum: ['open_only', 'close_only', 'both'] },
            payoutMultiplier: { type: 'number', nullable: true },
            minBet: { type: 'number', nullable: true },
            maxBet: { type: 'number', nullable: true },
            status: { type: 'string', enum: ['active', 'inactive'] },
          },
        },
      },
      allowedGameTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Codes of active game types for this market',
      },
    },
  },

  /* =========================
     BET VALUE TYPES (Dynamic per GameType.rules)
  ========================== */

  SingleDigitValue: {
    type: 'object',
    required: ['digit'],
    properties: {
      digit: {
        type: 'string',
        example: '5',
        description: 'Single digit (0-9)',
      },
    },
  },

  JodiValue: {
    type: 'object',
    required: ['jodi'],
    properties: {
      jodi: {
        type: 'string',
        example: '49',
        description: 'Two digit jodi (00-99)',
      },
    },
  },

  SinglePanaValue: {
    type: 'object',
    required: ['pana'],
    properties: {
      pana: {
        type: 'string',
        example: '128',
        description: '3-digit single pana',
      },
    },
  },

  DoublePanaValue: {
    type: 'object',
    required: ['pana'],
    properties: {
      pana: {
        type: 'string',
        example: '112',
        description: '3-digit double pana',
      },
    },
  },
  SpMotorValue: {
    type: 'object',
    required: ['panas'],
    properties: {
      panas: {
        type: 'array',
        minItems: 1,
        items: { type: 'string', example: '128' },
        example: ['123', '124', '234'],
        description: 'User-selected single panas for SP motor, typically chosen from the /motor/generate response. Values must already be in canonical zero-highest order. When placing the bet, the parent `amount` is the total stake across this full array, not per pana.',
      },
    },
  },
  DpMotorValue: {
    type: 'object',
    required: ['panas'],
    properties: {
      panas: {
        type: 'array',
        minItems: 1,
        items: { type: 'string', example: '112' },
        example: ['112', '122', '223'],
        description: 'User-selected double panas for DP motor, typically chosen from the /motor/generate response. Values must already be in canonical zero-highest order. When placing the bet, the parent `amount` is the total stake across this full array, not per pana.',
      },
    },
  },

  HalfSangamValue: {
    type: 'object',
    required: ['openPana', 'closeDigit'],
    properties: {
      openPana: {
        type: 'string',
        example: '128',
      },
      closeDigit: {
        type: 'string',
        example: '6',
      },
    },
  },
  HalfSangamAValue: {
    type: 'object',
    required: ['openPana', 'closeDigit'],
    properties: {
      openPana: {
        type: 'string',
        example: '128',
      },
      closeDigit: {
        type: 'string',
        example: '6',
      },
    },
  },
  HalfSangamBValue: {
    type: 'object',
    required: ['openDigit', 'closePana'],
    properties: {
      openDigit: {
        type: 'string',
        example: '5',
      },
      closePana: {
        type: 'string',
        example: '128',
      },
    },
  },

  /* =========================
     BETTING
  ========================== */

  Bet: {
    type: 'object',
    description: 'User bet record',
    properties: {
      id: {
        type: 'string',
      },
      sessionId: {
        type: 'string',
      },
      gameTypeId: {
        type: 'string',
      },
      // betMode: {
      //   type: "string",
      //   enum: ["open", "close"],
      // },
      selection: {
        type: 'string',
        example: '5',
      },
      value: {
        description: `
    Object-based bet value.
    Structure depends on GameType.rules.parts.
    Examples:
      - Single Digit → { "digit": "5" }
      - Jodi → { "jodi": "49" }
      - Single Pana → { "pana": "128" }
      - Double Pana → { "pana": "112" }
      - Half Sangam A → { "openPana": "128", "closeDigit": "6" }
      - Half Sangam B → { "openDigit": "5", "closePana": "128" }
  `,
        oneOf: [
          { $ref: '#/components/schemas/SingleDigitValue' },
          { $ref: '#/components/schemas/JodiValue' },
          { $ref: '#/components/schemas/SinglePanaValue' },
          { $ref: '#/components/schemas/DoublePanaValue' },
          { $ref: '#/components/schemas/HalfSangamValue' },
          { $ref: '#/components/schemas/HalfSangamAValue' },
          { $ref: '#/components/schemas/HalfSangamBValue' },
          { $ref: '#/components/schemas/SpMotorValue' },
          { $ref: '#/components/schemas/DpMotorValue' },
        ],
        nullable: true,
      },

      amount: {
        type: 'number',
        example: 100,
        description: 'Bet amount in INR',
      },
      oddsSnapshot: {
        type: 'number',
        example: 9.5,
        description: 'Odds at time of bet placement',
      },
      status: {
        type: 'string',
        enum: ['pending', 'won', 'lost'],
      },
      payout: {
        type: 'number',
        example: 950,
        description: 'Winning amount in INR (if won)',
      },
      generatedPanas: {
        type: 'array',
        items: { type: 'string', example: '123' },
        nullable: true,
      },
      combinationCount: {
        type: 'integer',
        nullable: true,
      },
      stakePerCombination: {
        type: 'number',
        nullable: true,
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
      },
    },
  },

  SpMotorGenerateRequest: {
    type: 'object',
    required: ['type', 'digits'],
    properties: {
      type: {
        type: 'string',
        enum: ['SP_MOTOR'],
      },
      digits: {
        type: 'array',
        minItems: 3,
        maxItems: 10,
        items: { type: 'integer', minimum: 0, maximum: 9 },
        example: [1, 2, 3, 4],
      },
    },
  },
  DpMotorGenerateRequest: {
    type: 'object',
    required: ['type', 'digits'],
    properties: {
      type: {
        type: 'string',
        enum: ['DP_MOTOR'],
      },
      digits: {
        type: 'array',
        minItems: 3,
        maxItems: 10,
        items: { type: 'integer', minimum: 0, maximum: 9 },
        example: [1, 2, 3],
      },
    },
  },
  MotorGenerateRequest: {
    oneOf: [
      { $ref: '#/components/schemas/SpMotorGenerateRequest' },
      { $ref: '#/components/schemas/DpMotorGenerateRequest' },
    ],
  },

  MotorGenerateResponse: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['SP_MOTOR', 'DP_MOTOR'] },
      digits: {
        type: 'array',
        items: { type: 'integer' },
      },
      panas: {
        type: 'array',
        items: { type: 'string', example: '123' },
        description: 'Generated panas in canonical zero-highest order (for example, 012 becomes 120).',
      },
      count: { type: 'integer', example: 4 },
      maxCombinations: { type: 'integer', nullable: true, example: null },
    },
  },

  /* =========================
     ADMIN – RESULT ENGINE
  ========================== */

  ResultSimulation: {
    type: 'object',
    description: 'Simulated outcome profitability',
    properties: {
      outcomePana: {
        type: 'string',
        example: '128',
      },
      outcomeDigit: {
        type: 'number',
        example: 1,
      },
      totalCollection: {
        type: 'number',
        example: 50000,
        description: 'Total bet collection (INR)',
      },
      totalPayout: {
        type: 'number',
        example: 32000,
      },
      netProfit: {
        type: 'number',
        example: 18000,
      },
    },
  },

  ResultSimulationAnalytics: {
    type: 'object',
    description: 'Admin simulation analytics built from pre-aggregated exposure maps',
    properties: {
      sessionId: { type: 'string' },
      sessionPhase: {
        type: 'string',
        enum: ['open_running', 'close_running', 'market_closed', 'settled'],
      },
      betMode: { type: 'string', enum: ['open', 'close'] },
      totalScenarios: { type: 'integer', example: 220 },
      totalCollection: { type: 'number', example: 50000 },
      totalBets: { type: 'integer', example: 1337 },
      digitStats: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            digit: { type: 'string', example: '1' },
            betCount: { type: 'integer', example: 110 },
            totalAmount: { type: 'number', example: 7400 },
            potentialPayout: { type: 'number', example: 70300 },
          },
        },
      },
      gameTypeStats: {
        type: 'object',
        description: 'Aggregated counts and amounts by game type code',
        additionalProperties: {
          type: 'object',
          properties: {
            count: { type: 'integer', example: 42 },
            amount: { type: 'number', example: 15000 },
          },
        },
        nullable: true,
      },
      topOutcomes: {
        type: 'array',
        items: { $ref: '#/components/schemas/ResultSimulation' },
      },
      riskOutcomes: {
        type: 'array',
        description: 'Top 5 highest payout outcomes',
        items: { $ref: '#/components/schemas/ResultSimulation' },
      },
    },
  },

  MarketResult: {
    type: 'object',
    description: 'Market result + session summary for the day',
    properties: {
      marketId: { type: 'string' },
      marketName: { type: 'string' },
      marketCode: { type: 'string' },
      sessionId: { type: 'string' },
      phase: {
        type: 'string',
        enum: ['open_running', 'close_running', 'market_closed', 'settled'],
      },
      status: {
        type: 'string',
        description:
          'Derived status for frontend: open_running | open_declared | close_running | market_closed | settled',
        example: 'open_running',
      },
      openTime: { type: 'string', format: 'date-time' },
      closeTime: { type: 'string', format: 'date-time' },
      result: {
        type: 'object',
        properties: {
          openPana: { type: 'string', nullable: true },
          openDigit: { type: 'integer', nullable: true },
          closePana: { type: 'string', nullable: true },
          closeDigit: { type: 'integer', nullable: true },
        },
      },
    },
  },

  MarketResultsResponse: {
    type: 'object',
    properties: {
      date: { type: 'string' },
      results: {
        type: 'array',
        items: { $ref: '#/components/schemas/MarketResult' },
      },
    },
  },

  /* =========================
     ADMIN â€“ LOGS
  ========================== */
  GameResultItem: {
    type: 'object',
    description: 'User-safe game result item',
    properties: {
      marketId: { type: 'string' },
      marketName: { type: 'string', nullable: true },
      sessionDate: {
        type: 'string',
        format: 'date',
        example: '2026-03-01',
      },
      phase: {
        type: 'string',
        enum: ['open_running', 'close_running', 'market_closed', 'settled'],
      },
      resultStatus: {
        type: 'string',
        enum: ['NOT_DECLARED', 'OPEN_ONLY', 'FULL_DECLARED', 'SETTLED'],
      },
      result: {
        type: 'object',
        properties: {
          openPana: { type: 'string', nullable: true },
          openDigit: { type: 'integer', nullable: true },
          closePana: { type: 'string', nullable: true },
          closeDigit: { type: 'integer', nullable: true },
        },
      },
    },
  },

  GameResultsListResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      statusCode: { type: 'integer', example: 200 },
      message: { type: 'string', example: 'Game results retrieved' },
      data: {
        type: 'array',
        items: { $ref: '#/components/schemas/GameResultItem' },
      },
      timestamp: { type: 'string', format: 'date-time' },
    },
  },
  AdminUserListItem: {
    type: 'object',
    properties: {
      id: { type: 'string', example: '65ff1aa616b1f1d2dde0fa82' },
      username: { type: 'string', example: 'johndoe' },
      phone: { type: 'string', example: '9876543210' },
      email: { type: 'string', nullable: true, example: 'john@example.com' },
      status: { type: 'string', enum: ['active', 'inactive', 'blocked'] },
      role: { type: 'string', nullable: true, example: 'ADMIN' },
      isVerified: { type: 'boolean', example: true },
      lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  AdminUsersListData: {
    type: 'object',
    properties: {
      users: {
        type: 'array',
        items: { $ref: '#/components/schemas/AdminUserListItem' },
      },
      pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer', example: 150 },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          totalPages: { type: 'integer', example: 8 },
        },
      },
    },
  },

  AdminUserDetailsData: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      username: { type: 'string' },
      phone: { type: 'string' },
      email: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['active', 'inactive', 'blocked'] },
      role: { type: 'string', nullable: true },
      isVerified: { type: 'boolean' },
      wallet: {
        type: 'object',
        properties: {
          balance: { type: 'number', example: 2500 },
          exposure: { type: 'number', example: 500 },
          bonus: { type: 'number', example: 0 },
          currency: { type: 'string', example: 'INR' },
        },
      },
      accountStatus: { type: 'string', enum: ['active', 'inactive', 'blocked'] },
      lastLogin: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  AdminUserStatusActionData: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      status: { type: 'string', enum: ['active', 'blocked'] },
    },
  },

  AdminUserStatsData: {
    type: 'object',
    properties: {
      totalBets: { type: 'integer', example: 120 },
      totalWagered: { type: 'number', example: 4500 },
      totalWinnings: { type: 'number', example: 5200 },
      totalLosses: { type: 'number', example: 1800 },
    },
  },

  AdminUserBetRow: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Expanded row ID for motor bets (e.g., {betId}_{pana}) or regular betId' },
      rowId: { type: 'string' },
      betId: { type: 'string', description: 'Underlying MongoDB Document ID' },
      expansionKey: { type: 'string', nullable: true, description: 'The specific pana for this expanded motor row' },
      isExpanded: { type: 'boolean', description: 'True if this is an expanded motor row' },
      editScope: { type: 'string', enum: ['bet', 'row'] },
      canEdit: { type: 'boolean' },
      canDelete: { type: 'boolean' },
      market: { type: 'string', nullable: true },
      gameType: { type: 'string', nullable: true },
      betMode: { type: 'string', enum: ['open', 'close'] },
      selection: { type: 'string' },
      amount: { type: 'number', description: 'Line stake in INR when isExpanded (motor); full bet stake otherwise' },
      totalAmount: { type: 'number', description: 'Full stored bet stake in INR (motor: same on every expanded row)' },
      odds: { type: 'number' },
      status: { type: 'string', enum: ['pending', 'won', 'lost', 'cancelled'] },
      payout: { type: 'number', description: 'Payout attributed to this row in INR' },
      totalPayout: { type: 'number', description: 'Same semantics as payout for this row (losing motor lines: 0 when bet won)' },
      placedAt: { type: 'string', format: 'date-time' },
    },
  },

  AdminUserBetsData: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/AdminUserBetRow' },
      },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          pages: { type: 'integer' },
        },
      },
    },
  },

  AdminBetEditRequest: {
    type: 'object',
    properties: {
      amount: { type: 'number', description: 'New amount in rupees', nullable: true },
      value: {
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }, { type: 'object' }],
        description: 'New selection. For expanded motor row, provide a single pana string.',
        nullable: true,
      },
    },
  },

  AdminBetEditData: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      rowId: { type: 'string' },
      betId: { type: 'string' },
      expansionKey: { type: 'string', nullable: true },
      isExpanded: { type: 'boolean' },
      amount: { type: 'number' },
      totalAmount: { type: 'number' },
      selection: { type: 'string' },
      status: { type: 'string' },
      wallet: {
        type: 'object',
        properties: {
          balance: { type: 'number' },
          exposure: { type: 'number' },
        },
      },
    },
  },

  AdminBetDeleteData: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      rowId: { type: 'string' },
      betId: { type: 'string' },
      expansionKey: { type: 'string', nullable: true },
      isExpanded: { type: 'boolean' },
      status: { type: 'string' },
      refundedAmount: { type: 'number' },
      wallet: {
        type: 'object',
        properties: {
          balance: { type: 'number' },
          exposure: { type: 'number' },
        },
      },
    },
  },

  DeclareOpenResultRequest: {
    type: 'object',
    required: ['openPana'],
    properties: {
      openPana: {
        type: 'string',
        example: '128',
        description: '3-digit open pana',
      },
    },
  },

  DeclareCloseResultRequest: {
    type: 'object',
    required: ['closePana'],
    properties: {
      closePana: {
        type: 'string',
        example: '235',
        description: '3-digit close pana',
      },
    },
  },

  ResetOpenResultRequest: {
    type: 'object',
    required: ['reason'],
    properties: {
      reason: { type: 'string', example: 'Resetting incorrect declaration; corrected result will be supplied later' },
      note: { type: 'string', nullable: true },
      expectedResultRevision: { type: 'integer', nullable: true, example: 3 },
    },
  },

  ResetCloseResultRequest: {
    type: 'object',
    required: ['reason'],
    properties: {
      reason: { type: 'string', example: 'Resetting incorrect declaration; corrected result will be supplied later' },
      note: { type: 'string', nullable: true },
      expectedResultRevision: { type: 'integer', nullable: true, example: 4 },
    },
  },

  AdminResultDeclarationData: {
    type: 'object',
    properties: {
      sessionId: { type: 'string' },
      declaredPhase: {
        type: 'string',
        enum: ['open_running', 'close_running', 'market_closed'],
      },
      result: { $ref: '#/components/schemas/SessionResultSnapshot' },
      currentResult: { $ref: '#/components/schemas/SessionResultSnapshot' },
      settledResult: { $ref: '#/components/schemas/SessionResultSnapshot' },
      resultRevision: { type: 'integer', example: 2 },
      settledResultRevision: { type: 'integer', example: 1 },
      settlementStatus: {
        type: 'string',
        enum: ['pending', 'processing', 'completed', 'failed'],
        nullable: true,
      },
      settlementJobId: { type: 'string', nullable: true },
      isFinanciallyConsistent: { type: 'boolean', example: false },
      warning: {
        allOf: [{ $ref: '#/components/schemas/ResultWarning' }],
        nullable: true,
      },
      resetReason: { type: 'string', nullable: true },
      derivedDigit: { type: 'integer', example: 1 },
      settlementQueued: { type: 'boolean', example: true },
      betMode: { type: 'string', enum: ['open', 'close'] },
    },
  },

  AdminWalletAdjustmentRequest: {
    type: 'object',
    required: ['operation', 'amount', 'reason', 'idempotencyKey'],
    properties: {
      operation: { type: 'string', enum: ['credit', 'debit'] },
      amount: { $ref: '#/components/schemas/MoneyINR' },
      reason: { type: 'string', example: 'Manual reconciliation adjustment' },
      idempotencyKey: { type: 'string', example: 'wallet_adj_2026_04_24_001' },
      note: { type: 'string', nullable: true },
      referenceSessionId: { type: 'string', nullable: true },
    },
  },

  AdminWalletAdjustmentData: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['credit', 'debit'] },
      balance: { $ref: '#/components/schemas/MoneyINR' },
      exposure: { $ref: '#/components/schemas/MoneyINR' },
      amount: { $ref: '#/components/schemas/MoneyINR' },
      idempotencyKey: { type: 'string' },
      transactionId: { type: 'string' },
      replayed: { type: 'boolean' },
    },
  },

  AdminSimulationOutcome: {
    type: 'object',
    properties: {
      pana: { type: 'string', example: '128' },
      digit: { type: 'integer', example: 1 },
      payout: { type: 'number', example: 23000 },
      profit: { type: 'number', example: 54000 },
    },
  },

  AdminSimulationData: {
    type: 'object',
    properties: {
      simulations: {
        type: 'array',
        items: { $ref: '#/components/schemas/AdminSimulationOutcome' },
      },
    },
  },

  NotificationRegisterDeviceRequest: {
    type: 'object',
    required: ['fcmToken'],
    properties: {
      fcmToken: { type: 'string', example: 'fcm_device_token_here' },
      deviceType: { type: 'string', example: 'android' },
      appVersion: { type: 'string', example: '1.0.0' },
    },
  },

  NotificationUpdateTokenRequest: {
    type: 'object',
    required: ['oldToken', 'newToken'],
    properties: {
      oldToken: { type: 'string', example: 'old_fcm_token' },
      newToken: { type: 'string', example: 'new_fcm_token' },
      deviceType: { type: 'string', example: 'android' },
      appVersion: { type: 'string', example: '1.0.1' },
    },
  },

  NotificationRemoveTokenRequest: {
    type: 'object',
    required: ['fcmToken'],
    properties: {
      fcmToken: { type: 'string', example: 'fcm_device_token_here' },
    },
  },

  LogEntry: {
    type: 'object',
    description: 'Structured log entry',
    properties: {
      id: { type: 'string', example: '65ff1aa616b1f1d2dde0fa82' },
      level: { type: 'string', enum: ['error', 'warn', 'info', 'debug'] },
      message: { type: 'string', example: 'request' },
      requestId: { type: 'string', nullable: true },
      userId: { type: 'string', nullable: true },
      route: { type: 'string', example: '/api/v1/admin/logs' },
      method: { type: 'string', example: 'GET' },
      ip: { type: 'string', example: '203.0.113.10' },
      statusCode: { type: 'integer', nullable: true },
      durationMs: { type: 'integer', nullable: true },
      meta: {
        type: 'object',
        nullable: true,
        properties: {
          audit: {
            type: 'object',
            nullable: true,
            properties: {
              category: { type: 'string', enum: ['FINANCIAL', 'ADMIN_OP'] },
            },
          },
        },
      },
      error: {
        type: 'object',
        nullable: true,
        properties: {
          name: { type: 'string', nullable: true },
          message: { type: 'string', nullable: true },
          stack: { type: 'string', nullable: true },
        },
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  LogListResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      statusCode: { type: 'integer', example: 200 },
      message: { type: 'string', example: 'Logs retrieved' },
      data: {
        type: 'array',
        items: { $ref: '#/components/schemas/LogEntry' },
      },
      pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 50 },
          total: { type: 'integer', example: 150 },
        },
      },
      timestamp: { type: 'string', format: 'date-time' },
    },
  },
};
