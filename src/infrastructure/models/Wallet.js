const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    currency: {
      type: String,
      enum: ['INR'],
      default: 'INR',
      immutable: true,
    },

    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      // Stored in PAISA
    },

    exposure: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      // Stored in PAISA
    },

    bonus: {
      type: Number,
      default: 0,
      min: 0,
      // Stored in PAISA
    },
  },
  { timestamps: true },
);

// For leaderboard / risk scans
walletSchema.index({ balance: -1 });

module.exports = mongoose.model('Wallet', walletSchema);
