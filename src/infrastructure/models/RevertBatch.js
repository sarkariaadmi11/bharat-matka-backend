/**
 * RevertBatch — persisted resumable batch entity
 *
 * WHY this model exists:
 *   Large revert operations (e.g., 10 000 bets) cannot be executed inside a single
 *   database transaction.  That approach is operationally brittle: one timeout or
 *   lock-contention error rolls back every refund already done, leaving the platform
 *   in an unrecoverable state with no progress saved.
 *
 *   Instead we record the full batch intent here and process bets in small chunks.
 *   Each chunk commits independently.  If the system crashes at bet 2 000/10 000:
 *     - the batch document remains with status 'processing' or 'failed'
 *     - lastProcessedCursor tells us exactly where to resume
 *     - bets already refunded carry revertBatchId so a retry cannot double-refund
 *
 * Status lifecycle:
 *   pending → processing → completed
 *                       ↘ failed  (resume is still possible from lastProcessedCursor)
 *
 * Design decision timestamp: 2026-04-23 23:21:27 +05:30
 * See docs/architecture/result-financial-divergence.md for full rationale.
 */

const mongoose = require('mongoose');
const { REVERT_BATCH_STATUS } = require('@config/constants/domain');

const revertBatchSchema = new mongoose.Schema(
  {
    // ── Core identity ──────────────────────────────────────────────────────

    /**
     * Session the revert targets.  Nullable to future-proof cross-session admin
     * reverts, but always present in practice today.
     */
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameSession',
      default: null,
      index: true,
    },

    /**
     * Declarative filter criteria persisted at creation time.
     * WHY: if the admin later asks "what was reverted and why?" we have the exact
     * scope criteria recorded, not just a count.
     */
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ── Authorship / audit ─────────────────────────────────────────────────
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    note: {
      type: String,
      default: null,
      trim: true,
    },

    /**
     * Idempotency key supplied by the caller.
     * Same key + same payload → return existing batch state.
     * Same key + different payload → 409 Conflict.
     * WHY: admin UIs often retry on network errors; we must not double-create batches.
     */
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /**
     * SHA-256 of the canonical request payload.
     * WHY: used for conflict detection when the same idempotencyKey is reused
     * with a different payload (detect accidental or malicious key reuse).
     */
    payloadHash: {
      type: String,
      required: true,
    },

    /**
     * Result revision observed at preflight time.
     * WHY: ties the batch to the result state that was current when the admin
     * initiated the revert; allows future auditors to understand the context.
     */
    resultRevisionObserved: {
      type: Number,
      default: null,
    },

    // ── Lifecycle status ──────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(REVERT_BATCH_STATUS),
      required: true,
      default: REVERT_BATCH_STATUS.PENDING,
      index: true,
    },

    failureReason: {
      type: String,
      default: null,
    },

    // ── Progress counters ──────────────────────────────────────────────────

    /** Total bets matched by the filter criteria */
    matchedCount: { type: Number, default: 0, min: 0 },

    /** Bets that passed the revert-eligibility check */
    eligibleCount: { type: Number, default: 0, min: 0 },

    /** Bets attempted so far (eligible + already-processed guard) */
    processedCount: { type: Number, default: 0, min: 0 },

    /** Bets successfully refunded */
    refundedCount: { type: Number, default: 0, min: 0 },

    /** Total stake amount (in paisa) refunded across all refunded bets */
    refundedAmount: { type: Number, default: 0, min: 0 },

    /** Bets skipped because already refunded (idempotent guard) */
    skippedCount: { type: Number, default: 0, min: 0 },

    /** Bets that failed their individual refund step */
    failedCount: { type: Number, default: 0, min: 0 },

    /**
     * Opaque cursor (typically a MongoDB _id string) pointing to the last
     * successfully processed bet.  Resume logic uses this to skip already-done work.
     * WHY: lets us restart a failed batch without re-processing from the beginning.
     */
    lastProcessedCursor: {
      type: String,
      default: null,
    },

    // ── Timestamps ────────────────────────────────────────────────────────
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Lookup by session to detect concurrent batches
revertBatchSchema.index({ sessionId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('RevertBatch', revertBatchSchema);
