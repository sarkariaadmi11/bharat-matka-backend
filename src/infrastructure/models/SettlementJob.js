const mongoose = require('mongoose');
const { BET_MODE, SETTLEMENT_STATUS } = require('@config/constants/domain');

const settlementJobSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameSession',
      required: true,
      index: true,
    },
    betMode: {
      type: String,
      enum: Object.values(BET_MODE),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(SETTLEMENT_STATUS),
      required: true,
      default: SETTLEMENT_STATUS.PROCESSING,
      index: true,
    },
    resultRevision: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },
    declaredResultSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastHeartbeatAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

settlementJobSchema.index({ sessionId: 1, resultRevision: 1, betMode: 1 }, { unique: true });
settlementJobSchema.index({ sessionId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('SettlementJob', settlementJobSchema);
