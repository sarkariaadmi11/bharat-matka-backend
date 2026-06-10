/**
 * RevertBatchRepository
 *
 * WHY a dedicated repository:
 *   The batch lifecycle involves several precise state transitions
 *   (pending → processing → completed / failed) and cursor-based progress
 *   updates that should not bleed into generic BaseRepository helpers.
 *   Keeping these methods here makes each transition traceable, testable,
 *   and impossible to call from the wrong layer.
 */

const BaseRepository = require('./baseRepository');
const { RevertBatch } = require('@infra/models');
const { REVERT_BATCH_STATUS } = require('@config/constants/domain');

class RevertBatchRepository extends BaseRepository {
  constructor() {
    super(RevertBatch);
  }

  // ── Status transitions ───────────────────────────────────────────────────

  /**
   * Transition batch to 'processing' and record start time.
   * WHY: called at the very beginning of execution so that admin UIs show
   * 'processing' rather than 'pending' while work is in progress.
   */
  async markProcessing(batchId, session = null) {
    return this.model.findByIdAndUpdate(
      batchId,
      {
        $set: {
          status: REVERT_BATCH_STATUS.PROCESSING,
          startedAt: new Date(),
          failedAt: null,
          failureReason: null,
        },
      },
      { new: true, session },
    );
  }

  /**
   * Persist per-chunk progress without changing top-level status.
   * WHY: each chunk commits this update independently so that a crash after
   * chunk N leaves the cursor at N, not at 0.  This is the core recovery
   * mechanism for resumable batches.
   *
   * @param {string}  batchId
   * @param {object}  progress  - counters to $inc and optional lastProcessedCursor
   * @param {object}  [session] - MongoDB session for atomic writes within a chunk
   */
  async saveChunkProgress(batchId, progress, session = null) {
    const { lastProcessedCursor, refundedCount, refundedAmount, skippedCount, failedCount, processedCount } = progress;

    const inc = {};
    if (refundedCount) {
      inc.refundedCount = refundedCount;
    }
    if (refundedAmount) {
      inc.refundedAmount = refundedAmount;
    }
    if (skippedCount) {
      inc.skippedCount = skippedCount;
    }
    if (failedCount) {
      inc.failedCount = failedCount;
    }
    if (processedCount) {
      inc.processedCount = processedCount;
    }

    const set = {};
    if (lastProcessedCursor !== undefined) {
      set.lastProcessedCursor = lastProcessedCursor;
    }

    return this.model.findByIdAndUpdate(
      batchId,
      {
        ...(Object.keys(inc).length ? { $inc: inc } : {}),
        ...(Object.keys(set).length ? { $set: set } : {}),
      },
      { new: true, session },
    );
  }

  /**
   * Transition batch to 'completed' and record final counters.
   */
  async markCompleted(batchId, finalCounts = {}, session = null) {
    return this.model.findByIdAndUpdate(
      batchId,
      {
        $set: {
          status: REVERT_BATCH_STATUS.COMPLETED,
          completedAt: new Date(),
          failedAt: null,
          failureReason: null,
          ...finalCounts,
        },
      },
      { new: true, session },
    );
  }

  /**
   * Transition batch to 'failed' and record reason.
   * WHY: 'failed' does NOT mean "unrecoverable".  The lastProcessedCursor
   * is preserved so the admin (or an automated recovery job) can resume
   * from the safe point.
   */
  async markFailed(batchId, reason, session = null) {
    return this.model.findByIdAndUpdate(
      batchId,
      {
        $set: {
          status: REVERT_BATCH_STATUS.FAILED,
          failedAt: new Date(),
          failureReason: reason || 'Revert batch execution failed',
        },
      },
      { new: true, session },
    );
  }

  // ── Lookups ──────────────────────────────────────────────────────────────

  /**
   * Find an existing batch by idempotency key for replay-safety checks.
   */
  async findByIdempotencyKey(idempotencyKey, session = null) {
    const query = this.model.findOne({ idempotencyKey });
    if (session) {
      query.session(session);
    }
    return query;
  }

  /**
   * Return any active (pending/processing) batch for a session.
   * WHY: used for the concurrent-batch conflict check — we reject new batches
   * when one is already running on the same session to prevent interleaved
   * refunds that could corrupt progress counters.
   */
  async findActiveBySession(sessionId, session = null) {
    const query = this.model.findOne({
      sessionId,
      status: { $in: [REVERT_BATCH_STATUS.PENDING, REVERT_BATCH_STATUS.PROCESSING] },
    });
    if (session) {
      query.session(session);
    }
    return query;
  }

  /**
   * List batches for a session ordered newest-first (admin dashboard).
   */
  async findBySession(sessionId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model.find({ sessionId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.model.countDocuments({ sessionId }),
    ]);
    return { items, total, page, limit };
  }
}

module.exports = RevertBatchRepository;
