const mongoose = require('mongoose');
const {
  DEPOSIT_PROVIDER,
  WITHDRAWAL_METHOD,
  WITHDRAWAL_STATUS,
} = require('@config/constants/payments');

const payoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    provider: {
      type: String,
      default: DEPOSIT_PROVIDER.MANUAL_WITHDRAWAL,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      // Stored in PAISE
    },

    currency: { type: String, default: 'INR' },

    method: {
      type: String,
      enum: Object.values(WITHDRAWAL_METHOD),
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(WITHDRAWAL_STATUS),
      default: WITHDRAWAL_STATUS.PENDING,
      index: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    reference: { type: String },

    beneficiary: {
      bankDetailId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BankDetail',
      },
      upiId: { type: String },
      bankAccount: { type: String },
      ifsc: { type: String },
      accountHolderName: { type: String },
      bankName: { type: String },
    },

    failureReason: { type: String },
    adminRemarks: { type: String },
    adminApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    adminApprovedAt: { type: Date },

    processedAt: { type: Date },
    reversedAt: { type: Date },

    meta: { type: Object, default: {} },
  },
  { timestamps: true },
);

payoutSchema.index({ status: 1, createdAt: -1 });
payoutSchema.index({ userId: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model('Payout', payoutSchema);
