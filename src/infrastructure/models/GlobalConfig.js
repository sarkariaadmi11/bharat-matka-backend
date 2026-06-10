const mongoose = require('mongoose');

const globalConfigSchema = new mongoose.Schema(
  {
    systemLocked: {
      type: Boolean,
      default: false,
    },

    currencyRate: {
      type: Number, // Points → INR
      required: true,
      default: 1,
    },

    upiMerchantId: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },

    resultDeclarationGraceHours: {
      type: Number,
      default: 5,
      min: 0,
      max: 23,
      description: 'Hours after session closeTime during which admins can declare results. Also determines defer time (graceHours:01 next day) for session creation when results are pending.',
    },

    minimumDeposit: {
      type: Number,
      default: 100,
      min: 0,
      description: 'Minimum deposit amount in INR',
    },

    maximumDeposit: {
      type: Number,
      default: 100000,
      min: 0,
      description: 'Maximum deposit amount in INR',
    },

    minimumWithdrawal: {
      type: Number,
      default: 100,
      min: 0,
      description: 'Minimum withdrawal amount in INR',
    },

    maximumWithdrawal: {
      type: Number,
      default: 100000,
      min: 0,
      description: 'Maximum withdrawal amount in INR',
    },

    minimumBidAmount: {
      type: Number,
      default: 10,
      min: 0,
      description: 'Minimum bid/bet amount in INR',
    },

    maximumBidAmount: {
      type: Number,
      default: 10000,
      min: 0,
      description: 'Maximum bid/bet amount in INR',
    },

    welcomeBonus: {
      type: Number,
      default: 5,
      min: 0,
      description: 'Welcome bonus amount in INR',
    },

    withdrawOpenTime: {
      type: String,
      default: '09:00',
      trim: true,
      description: 'Withdrawal window open time in HH:mm 24-hour format',
    },

    withdrawCloseTime: {
      type: String,
      default: '13:00',
      trim: true,
      description: 'Withdrawal window close time in HH:mm 24-hour format',
    },

    globalBetting: {
      type: Boolean,
      default: false,
      description: 'Master switch to enable/disable all betting globally',
    },

    supportContact: {
      whatsappNumber: {
        type: String,
        default: null,
        trim: true,
        match: /^\d{10}$/,
        description: 'WhatsApp number for customer support (10 digits)',
      },
      telegramLink: {
        type: String,
        default: null,
        trim: true,
        description: 'Telegram handle for customer support (starts with @)',
      },
      supportEmail: {
        type: String,
        default: null,
        trim: true,
        lowercase: true,
        maxlength: 254,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        description: 'Email address for customer support',
      },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('GlobalConfig', globalConfigSchema);
