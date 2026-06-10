/**
 * RevertBatchService
 *
 * Implements the resumable, idempotent revert execution model described in
 * docs/architecture/result-financial-divergence.md.
 *
 * Core invariants this file must never violate:
 *   1. A bet can only be refunded once.  The deleteBet repository method
 *      (conditional findOneAndDelete with status=PENDING, revertBatchId=null)
 *      provides the database-level guard; this service layers the
 *      application-level guard on top.
 *   2. A batch can always be resumed from its lastProcessedCursor without
 *      re-processing bets that were already handled in a prior run.
 *   3. Eligibility is evaluated in preflight only.  Execution never partially
 *      starts and then discovers an ineligible bet — that path is rejected
 *      entirely before any refund touches the ledger.
 *   4. No giant cross-batch MongoDB transaction.  Each chunk commits
 *      independently.  This is safe because of invariant #1.
 *   5. No REFUND transaction is created — all traces (Bet + BET_DEBIT txn)
 *      are permanently removed, leaving the wallet as if the bet never existed.
 *
 * Key design decisions recorded at 2026-04-23 23:21:27 +05:30.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const { RepositoryFactory } = require('@infra/database');
const {
  REVERT_BATCH_STATUS,
} = require('@config/constants/domain');
const { ValidationError, NotFoundError, ConflictError } = require('@utils/errors');
const logger = require('@utils/logger');
// const { toRupees } = require('@utils');

const betRepository = RepositoryFactory.getRepository('Bet');
const revertBatchRepository = RepositoryFactory.getRepository('RevertBatch');
const gameSessionRepository = RepositoryFactory.getRepository('GameSession');
const walletRepository = RepositoryFactory.getRepository('Wallet');
const transactionRepository = RepositoryFactory.getRepository('Transaction');

// ── Configuration ────────────────────────────────────────────────────────────
// WHY chunk size matters: too small → many round-trips; too large → long-lived
// per-chunk transactions that increase lock pressure.  100 bets per chunk is a
// safe starting point and can be tuned via env without code changes.
const CHUNK_SIZE = Number(process.env.REVERT_BATCH_CHUNK_SIZE || 100);

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Deterministic payload hash for idempotency conflict detection.
 * WHY: the same idempotencyKey with a different payload is a conflict (e.g., a
 * copy-paste mistake by the operator).  We detect this without loading all
 * previous batch data, just by comparing hashes.
 */
const buildPayloadHash = ({ sessionId, reason, note }) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify({ sessionId: String(sessionId), reason: reason || '', note: note || '' }))
    .digest('hex');

// ── Preflight ─────────────────────────────────────────────────────────────────

/**
 * Run all eligibility checks before creating the batch.
 * If ANY check fails the batch is rejected entirely — no partial starts.
 *
 * Checks:
 *   - Session exists
 *   - At least one eligible bet exists (otherwise the batch is a no-op)
 *   - No other active batch on the same session (concurrent-batch conflict)
 */
const runPreflight = async (sessionId) => {
  const session = await gameSessionRepository.findById(sessionId);
  if (!session) {
    throw new NotFoundError('Session not found');
  }

  const [eligibleCount, activeBatch] = await Promise.all([
    betRepository.countEligibleForRevert(sessionId, null),
    revertBatchRepository.findActiveBySession(sessionId),
  ]);

  if (activeBatch) {
    throw new ConflictError(
      `A revert batch (${activeBatch._id}) is already active for this session. Wait for it to complete or fail before creating a new batch.`,
    );
  }

  return { session, eligibleCount };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new revert batch.
 *
 * WHY idempotencyKey is required:
 *   Admin UIs retry on network errors.  Without idempotency we would create
 *   duplicate batches.  With it, the second call returns the existing batch
 *   document instead of creating another one.
 *
 * @param {object} params
 * @param {string} params.sessionId
 * @param {string} params.reason
 * @param {string} [params.note]
 * @param {string} params.idempotencyKey
 * @param {string} params.adminUserId
 * @returns {object} created or existing RevertBatch document
 */
const createRevertBatch = async ({ sessionId, reason, note, idempotencyKey, adminUserId }) => {
  if (!idempotencyKey) {
    throw new ValidationError('idempotencyKey is required for revert batch creation');
  }

  const payloadHash = buildPayloadHash({ sessionId, reason, note });

  // ── Idempotency check ──────────────────────────────────────────────────────
  const existing = await revertBatchRepository.findByIdempotencyKey(idempotencyKey);
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new ConflictError('idempotencyKey was already used with a different revert batch payload');
    }

    logger.info({
      message: 'revert_batch.replayed',
      batchId: String(existing._id),
      idempotencyKey,
    });

    return { batch: existing, replayed: true };
  }

  // ── Preflight ──────────────────────────────────────────────────────────────
  const { session, eligibleCount } = await runPreflight(sessionId);

  if (eligibleCount === 0) {
    throw new ValidationError('No eligible pending bets found in this session. Nothing to revert.');
  }

  // ── Create batch document ──────────────────────────────────────────────────
  const batch = await revertBatchRepository.create({
    sessionId,
    reason,
    note: note || null,
    idempotencyKey,
    payloadHash,
    requestedBy: adminUserId,
    status: REVERT_BATCH_STATUS.PENDING,
    filters: { sessionId: String(sessionId) },
    resultRevisionObserved: session.resultRevision || 0,
    matchedCount: eligibleCount,
    eligibleCount,
  });

  logger.info({
    message: 'revert_batch.created',
    batchId: String(batch._id),
    sessionId: String(sessionId),
    eligibleCount,
    adminUserId: adminUserId ? String(adminUserId) : null,
    reason,
    resultRevisionObserved: session.resultRevision || 0,
  });

  return { batch, replayed: false };
};

/**
 * Execute a revert batch — or resume a previously failed/processing batch.
 *
 * Execution strategy:
 *   1. Fetch a chunk of eligible bets (cursor-based, _id ascending)
 *   2. For each bet in the chunk:
 *      a. Open a per-bet MongoDB session
 *      b. Call deleteBet (conditional delete = double-guard)
 *      c. If deleted (not already reverted):
 *         - Restore wallet via releaseBetExposure
 *         - Delete the original BET_DEBIT transaction
 *         - Commit per-bet transaction
 *      d. If null (already deleted/reverted): abort, count as skipped
 *      e. Increment appropriate counter (refunded | skipped | failed)
 *   3. Persist chunk progress to the batch document (lastProcessedCursor advances)
 *   4. Repeat until no more bets in chunk
 *   5. Mark batch completed
 *
 * NOTE: No REFUND transaction is created — all traces of the bet are
 * removed (Bet document + BET_DEBIT transaction). The wallet is restored
 * to its pre-bid state.
 *
 * Crash recovery:
 *   If the process dies after step 3 the batch is in 'processing' or 'failed'.
 *   Calling executeRevertBatch again with the same batchId resumes from
 *   lastProcessedCursor because the chunk query uses _id > cursor.
 *
 * @param {string} batchId - RevertBatch _id
 */
const executeRevertBatch = async (batchId) => {
  const batch = await revertBatchRepository.findById(batchId);
  if (!batch) {
    throw new NotFoundError(`RevertBatch ${batchId} not found`);
  }

  if (batch.status === REVERT_BATCH_STATUS.COMPLETED) {
    logger.info({ message: 'revert_batch.already_completed', batchId: String(batchId) });
    return batch;
  }

  // Transition to processing (idempotent — safe to call even on resumed batch)
  await revertBatchRepository.markProcessing(batchId);

  const { sessionId } = batch;

  let cursor = batch.lastProcessedCursor || null;
  let totalRefunded = 0;
  let totalRefundedAmount = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  try {

    while (true) {
      const chunk = await betRepository.findChunkForRevert(sessionId, null, cursor, CHUNK_SIZE);

      // No more bets → execution complete
      if (!chunk || chunk.length === 0) {
        break;
      }

      let chunkRefunded = 0;
      let chunkRefundedAmount = 0;
      let chunkSkipped = 0;
      let chunkFailed = 0;

      for (const bet of chunk) {
        const betMongoSession = await mongoose.startSession();
        betMongoSession.startTransaction();

        try {
          // Conditionally delete the bet — if already deleted/reverted by
          // another worker, deleteBet returns null (no double-delete).
          const deletedBet = await betRepository.deleteBet(bet._id, betMongoSession);

          if (!deletedBet) {
            await betMongoSession.abortTransaction();
            chunkSkipped += 1;
          } else {
            // Restore wallet: release exposure lock, credit balance back
            await walletRepository.releaseBetExposure(bet.userId, bet.amount, betMongoSession);

            // Remove the bet from its BET_DEBIT transaction (deletes
            // the txn if it was the only bet, otherwise pulls the betId)
            await transactionRepository.removeBetFromDebitTransaction(bet._id, betMongoSession);

            await betMongoSession.commitTransaction();
            chunkRefunded += 1;
            chunkRefundedAmount += bet.amount;
          }
        } catch (err) {
          await betMongoSession.abortTransaction();
          chunkFailed += 1;

          logger.error({
            message: 'revert_batch.bet_refund_failed',
            batchId: String(batchId),
            betId: String(bet._id),
            error: err?.message,
          });
        } finally {
          betMongoSession.endSession();
        }
      }

      // Advance cursor to last bet in chunk
      cursor = String(chunk[chunk.length - 1]._id);

      // Persist chunk progress — commits even if some bets failed
      await revertBatchRepository.saveChunkProgress(batchId, {
        lastProcessedCursor: cursor,
        processedCount: chunk.length,
        refundedCount: chunkRefunded,
        refundedAmount: chunkRefundedAmount,
        skippedCount: chunkSkipped,
        failedCount: chunkFailed,
      });

      totalRefunded += chunkRefunded;
      totalRefundedAmount += chunkRefundedAmount;
      totalSkipped += chunkSkipped;
      totalFailed += chunkFailed;

      logger.info({
        message: 'revert_batch.chunk_complete',
        batchId: String(batchId),
        chunkSize: chunk.length,
        chunkRefunded,
        chunkSkipped,
        chunkFailed,
        cursor,
      });
    }

    const completedBatch = await revertBatchRepository.markCompleted(batchId, {
      refundedCount: batch.refundedCount + totalRefunded,
      refundedAmount: batch.refundedAmount + totalRefundedAmount,
      skippedCount: batch.skippedCount + totalSkipped,
      failedCount: batch.failedCount + totalFailed,
    });

    logger.info({
      message: 'revert_batch.completed',
      batchId: String(batchId),
      sessionId: String(sessionId),
      totalRefunded,
      totalSkipped,
      totalFailed,
    });

    return completedBatch;
  } catch (error) {
    const failedBatch = await revertBatchRepository.markFailed(batchId, error?.message);

    logger.error({
      message: 'revert_batch.failed',
      batchId: String(batchId),
      sessionId: String(sessionId),
      totalRefunded,
      totalSkipped,
      totalFailed,
      error: error?.message,
    });

    return failedBatch;
  }
};

/**
 * Get a single batch by ID.
 * Used by the admin status-polling endpoint.
 */
const getRevertBatch = async (batchId) => {
  const batch = await revertBatchRepository.findById(batchId);
  if (!batch) {
    throw new NotFoundError(`RevertBatch ${batchId} not found`);
  }
  return batch;
};

/**
 * List batches for a session (admin dashboard view).
 */
const listRevertBatchesForSession = async (sessionId, { page, limit } = {}) => {
  const session = await gameSessionRepository.findById(sessionId);
  if (!session) {
    throw new NotFoundError('Session not found');
  }
  return revertBatchRepository.findBySession(sessionId, { page, limit });
};

/**
 * Paginated bid history for a session (admin read-only).
 * Returns bets with user info populated for admin review.
 *
 * @param {string} sessionId
 * @param {number} page
 * @param {number} limit
 */
const getBidHistory = async (sessionId, page = 1, limit = 20) => {
  const session = await gameSessionRepository.findLeanById(sessionId);
  if (!session) {
    throw new NotFoundError('Session not found');
  }

  const { items, total } = await betRepository.findBySessionWithUser(sessionId, page, limit);

  const mapped = items.map((bet) => ({
    betId: String(bet._id),
    date: bet.createdAt,
    username: bet.userId?.username || '—',
    gameType: bet.gameTypeCodeSnapshot || bet.gameTypeTemplateKey || '—',
    points: bet.amount || 0,
    betMode: bet.betMode,
    selection: bet.selection,
    status: bet.status,
  }));

  return {
    items: mapped,
    pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  };
};

/**
 * Schedule a revert batch for async background processing via the EventTask system.
 * Returns immediately; the batch is picked up by the next PendingTasksProcessor cycle.
 */
const scheduleAsyncBatchProcessing = async (batchId) => {
  const EventTaskRegistry = require('@infra/queue/eventTaskRegistry');
  const eventTaskTypes = require('@config/constants/eventTaskTypes');

  await EventTaskRegistry.scheduleTask({
    type: eventTaskTypes.PROCESS_REVERT_BATCH,
    scheduledAt: new Date(),
    payload: { batchId: String(batchId) },
    priority: 2,
    maxAttempts: 3,
  });

  logger.info({
    message: 'revert_batch.queued_for_async',
    batchId: String(batchId),
  });
};

/**
 * Create a revert-all batch for a session.
 * The batch is persisted immediately but NOT executed inline — it is enqueued
 * for async background processing so the admin request returns quickly.
 *
 * @param {object} params
 * @param {string} params.sessionId
 * @param {string} params.reason
 * @param {string} [params.note]
 * @param {string} params.idempotencyKey
 * @param {string} params.adminUserId
 * @returns {Promise<{batch: object, replayed: boolean}>}
 */
const createRevertAllBatch = async ({ sessionId, reason, note, idempotencyKey, adminUserId }) => {
  const session = await gameSessionRepository.findById(sessionId);
  if (!session) {
    throw new NotFoundError('Session not found');
  }

  const activeBatch = await revertBatchRepository.findActiveBySession(sessionId);
  if (activeBatch) {
    throw new ConflictError(
      `A revert batch (${activeBatch._id}) is already active for this session. Wait for it to complete or fail before creating a new batch.`,
    );
  }

  const eligibleCount = await betRepository.countEligibleForRevert(sessionId, null);
  if (eligibleCount === 0) {
    throw new ValidationError('No eligible pending bets found in this session. Nothing to revert.');
  }

  const payloadHash = buildPayloadHash({ sessionId, reason, note });

  const existing = await revertBatchRepository.findByIdempotencyKey(idempotencyKey);
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new ConflictError('idempotencyKey was already used with a different revert batch payload');
    }

    logger.info({
      message: 'revert_batch.replayed',
      batchId: String(existing._id),
      idempotencyKey,
    });

    return { batch: existing, replayed: true };
  }

  const batch = await revertBatchRepository.create({
    sessionId,
    reason,
    note: note || null,
    idempotencyKey,
    payloadHash,
    requestedBy: adminUserId,
    status: REVERT_BATCH_STATUS.PENDING,
    filters: { sessionId: String(sessionId) },
    resultRevisionObserved: session.resultRevision || 0,
    matchedCount: eligibleCount,
    eligibleCount,
  });

  logger.info({
    message: 'revert_all_batch.created',
    batchId: String(batch._id),
    sessionId: String(sessionId),
    eligibleCount,
    adminUserId: adminUserId ? String(adminUserId) : null,
    reason,
  });

  return { batch, replayed: false };
};

// ── Mappers (shape data for API response) ─────────────────────────────────────

const mapBatch = (batch) => ({
  batchId: String(batch._id),
  sessionId: batch.sessionId ? String(batch.sessionId) : null,
  status: batch.status,
  reason: batch.reason,
  note: batch.note || null,
  idempotencyKey: batch.idempotencyKey,
  resultRevisionObserved: batch.resultRevisionObserved,
  progress: {
    matchedCount: batch.matchedCount,
    eligibleCount: batch.eligibleCount,
    processedCount: batch.processedCount,
    refundedCount: batch.refundedCount,
    refundedAmount: batch.refundedAmount,
    skippedCount: batch.skippedCount,
    failedCount: batch.failedCount,
    lastProcessedCursor: batch.lastProcessedCursor || null,
  },
  failureReason: batch.failureReason || null,
  startedAt: batch.startedAt || null,
  completedAt: batch.completedAt || null,
  failedAt: batch.failedAt || null,
  createdAt: batch.createdAt,
});

/**
 * Mark a batch as failed (used when async scheduling fails after creation).
 * Ensures the batch is not stuck in 'pending' blocking future retries.
 */
const markBatchFailed = async (batchId, reason) => {
  return revertBatchRepository.markFailed(batchId, reason);
};

module.exports = {
  createRevertBatch,
  executeRevertBatch,
  getRevertBatch,
  listRevertBatchesForSession,
  mapBatch,
  getBidHistory,
  createRevertAllBatch,
  scheduleAsyncBatchProcessing,
  markBatchFailed,
};
