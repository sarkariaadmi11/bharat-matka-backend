const mongoose = require('mongoose');

const resultAuditRecordSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameSession',
      required: true,
      index: true,
    },
    resultRevision: {
      type: Number,
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null for system actions if any, but usually an admin
      index: true,
    },
    action: {
      type: String,
      enum: ['declare_open', 'declare_close', 'reset_open', 'reset_close'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    beforeSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    afterSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    financialStateChanged: {
      type: Boolean,
      required: true,
      description: 'True if this action triggered settlement or caused a divergence with settled results',
    },
    settlementJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SettlementJob',
      default: null,
      index: true,
    },
    revertBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RevertBatch',
      default: null,
    },
    note: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// Compound index for querying session history in order
resultAuditRecordSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.model('ResultAuditRecord', resultAuditRecordSchema);
