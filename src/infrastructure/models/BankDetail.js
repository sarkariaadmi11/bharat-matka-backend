const mongoose = require('mongoose');

const bankDetailSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountHolderName: {
      type: String,
      required: true,
      trim: true,
    },
    bankName: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: false,
      default: null,
      trim: true,
    },
    ifscCode: {
      type: String,
      required: false,
      default: null,
      trim: true,
      uppercase: true,
    },
    upiId: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

bankDetailSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('BankDetail', bankDetailSchema);
