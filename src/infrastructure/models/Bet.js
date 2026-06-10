const mongoose = require('mongoose');
const { BET_MODE, BET_STATUS } = require('@config/constants/domain');

const betSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameSession',
      required: true,
    },

    gameTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameType',
      required: true,
    },

    // betType: {
    //   type: String, // logical grouping (easy, special, etc.)
    //   required: true,
    // },

    betMode: {
      type: String, // open / close
      required: true,
      enum: Object.values(BET_MODE),
    },

    selection: {
      type: String, // "5", "128", "2,5,9"
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
      // Stored in PAISA
    },

    oddsSnapshot: {
      type: Number,
      required: true,
    },

    gameTypeCodeSnapshot: {
      type: String,
      default: null,
    },

    gameTypeTemplateKey: {
      type: String,
      default: null,
    },

    gameTypeRulesVersion: {
      type: Number,
      default: 1,
      min: 1,
    },

    generatedPanas: {
      type: [String],
      default: null,
    },

    combinationCount: {
      type: Number,
      default: null,
      min: 1,
    },

    stakePerCombination: {
      type: Number,
      default: null,
      min: 0,
    },

    /**
     * Optional per-pana stakes (paise) for SP_MOTOR / DP_MOTOR when lines are not evenly split.
     * Keys are canonical pana strings; values must sum to `amount` when present.
     */
    motorLineStakesPaise: {
      type: Map,
      of: Number,
      default: undefined,
    },

    status: {
      type: String,
      enum: [BET_STATUS.PENDING, BET_STATUS.WON, BET_STATUS.LOST, BET_STATUS.CANCELLED],
      default: BET_STATUS.PENDING,
    },

    payout: {
      type: Number,
      default: 0,
    },

    // ── Revert / refund safety metadata ─────────────────────────────────────
    // WHY: These fields form the idempotency guard that makes resumable batch
    // processing safe.  Before issuing a refund, the batch processor checks
    // revertBatchId.  If it is already set the bet is skipped (counted as
    // 'skipped') and never double-refunded, even if the worker crashes and
    // restarts at an arbitrary point.

    /** ID of the RevertBatch that refunded this bet's stake. Null = not reverted. */
    revertBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RevertBatch',
      default: null,
      index: true,
    },

    /** Timestamp when the stake refund was issued. */
    revertedAt: {
      type: Date,
      default: null,
    },

    /** Admin user ID who initiated the revert batch. */
    revertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    /** Human-readable reason for the revert (copied from the batch). */
    revertReason: {
      type: String,
      default: null,
    },

    /** Transaction ID of the REFUND ledger entry for this bet's stake. */
    refundTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
  },
  { timestamps: true },
);

// INDEXES (ONLY WHAT IS USED IN QUERIES)
betSchema.index({ sessionId: 1, status: 1 });
betSchema.index({ gameTypeId: 1, selection: 1, sessionId: 1 });
betSchema.index({ userId: 1, createdAt: -1 });
betSchema.index({ sessionId: 1, gameTypeId: 1, userId: 1, status: 1, createdAt: -1 });
betSchema.index({ sessionId: 1, betMode: 1, createdAt: -1 });
betSchema.index({ sessionId: 1, betMode: 1, selection: 1 });
betSchema.index({ sessionId: 1, status: 1, gameTypeId: 1, userId: 1 });

module.exports = mongoose.model('Bet', betSchema);
