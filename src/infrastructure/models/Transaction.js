const mongoose = require('mongoose');
const {
  BET_MODE,
  BET_STATUS,
  TRANSACTION_TYPE,
  TRANSACTION_SOURCE,
  TRANSACTION_REFERENCE_TYPE,
} = require('@config/constants/domain');

const transactionContextSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: Object.values(TRANSACTION_SOURCE),
      required: true,
    },
    referenceType: {
      type: String,
      enum: Object.values(TRANSACTION_REFERENCE_TYPE),
      required: true,
    },
  },
  { _id: false },
);

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPE),
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      // Stored in PAISE (integer, for accuracy)
      // Negative for debits, positive for credits
    },

    balanceAfter: {
      type: Number,
      required: true,
      // Stored in PAISE
    },

    // ===== BET CONTEXT =====
    betIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bet',
        index: true,
      },
    ],

    betCount: {
      type: Number,
      default: 1,
    },

    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameSession',
      index: true,
    },

    marketCode: String, // 'KALYAN', 'MAIN', etc.

    gameTypeCode: String, // 'SINGLE', 'JODI', 'PANA'

    selections: [String], // ["5", "128", "2-5-9"]

    betMode: {
      type: String,
      enum: Object.values(BET_MODE),
    },

    // ===== SETTLEMENT CONTEXT =====
    betResult: {
      type: String,
      enum: [BET_STATUS.PENDING, BET_STATUS.WON, BET_STATUS.LOST, BET_STATUS.REFUNDED],
      default: null,
      index: true,
    },

    winAmount: {
      type: Number,
      default: 0,
      // Stored in PAISE
    },

    relatedTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },

    referenceType: {
      type: String,
      enum: Object.values(TRANSACTION_REFERENCE_TYPE),
      required: true,
      index: true,
    },

    transactionContext: {
      type: transactionContextSchema,
      required: true,
    },

    referenceId: String, // Original reference (bet ID, payment ID, payout ID, etc.)

    idempotencyKey: {
      type: String,
      default: null,
      index: true,
    },

    payloadHash: {
      type: String,
      default: null,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

// Compound index for efficient ledger queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, type: 1, betResult: 1 });
transactionSchema.index({ sessionId: 1, type: 1, createdAt: -1 });
transactionSchema.index({ sessionId: 1, type: 1, createdAt: -1, userId: 1 });
transactionSchema.index(
  { userId: 1, type: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);

transactionSchema.pre('validate', function validateTransactionContract() {
  if (!this.transactionContext?.source || !this.transactionContext?.referenceType) {
    throw new Error('transactionContext.source and transactionContext.referenceType are required');
  }

  this.referenceType = this.transactionContext.referenceType;

  const betResultAllowedTypes = new Set([
    TRANSACTION_TYPE.BET_DEBIT,
    TRANSACTION_TYPE.WIN_CREDIT,
    TRANSACTION_TYPE.REFUND,
  ]);

  if (!betResultAllowedTypes.has(this.type) && this.betResult) {
    throw new Error(`betResult is not allowed for transaction type ${this.type}`);
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
