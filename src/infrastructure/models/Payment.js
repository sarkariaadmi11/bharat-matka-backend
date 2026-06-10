const mongoose = require('mongoose');
const {
  DEPOSIT_PROVIDER,
  DEPOSIT_STATUS,
  DEPOSIT_VERIFICATION_STATUS,
} = require('@config/constants/payments');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    provider: {
      type: String,
      enum: Object.values(DEPOSIT_PROVIDER),
      default: DEPOSIT_PROVIDER.RAZORPAY,
      index: true,
    },

    transactionType: {
      type: String,
      enum: ['deposit'],
      default: 'deposit',
      index: true,
    },

    referenceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    paymentReference: {
      type: String,
      index: true,
    },

    merchantTxnId: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },

    razorpayOrderId: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },

    razorpayPaymentId: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
    },

    razorpaySignature: { type: String },

    upiTxnRef: {
      type: String,
      index: true,
      sparse: true,
    },

    upiApprovalRefNo: {
      type: String,
      index: true,
      sparse: true,
    },

    upiTransactionId: {
      type: String,
      index: true,
      sparse: true,
    },

    clientStatus: {
      type: String,
      index: true,
    },

    verificationStatus: {
      type: String,
      enum: Object.values(DEPOSIT_VERIFICATION_STATUS),
      default: DEPOSIT_VERIFICATION_STATUS.PENDING,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      // Stored in PAISE
    },

    currency: { type: String, default: 'INR' },

    method: { type: String },

    status: {
      type: String,
      enum: Object.values(DEPOSIT_STATUS),
      default: DEPOSIT_STATUS.PENDING,
      index: true,
    },

    adminRemarks: { type: String },
    adminApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    adminApprovedAt: { type: Date },

    receipt: { type: String },

    paidAt: { type: Date },
    creditedAt: { type: Date },
    failedAt: { type: Date },
    rawCallbackPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    meta: { type: Object, default: {} },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({ userId: 1, transactionType: 1, createdAt: -1, _id: -1 });
paymentSchema.index({ transactionType: 1, status: 1, createdAt: -1 });
paymentSchema.index({ transactionType: 1, provider: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, transactionType: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
