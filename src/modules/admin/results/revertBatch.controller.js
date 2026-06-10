/**
 * RevertBatch controller — matched to the codebase asyncHandler/sendSuccess pattern.
 * Thin HTTP adapter: validates, delegates to service, formats response.
 */
const mongoose = require('mongoose');
const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils/response');
const { ValidationError, NotFoundError } = require('@utils/errors');
const { RepositoryFactory } = require('@infra/database');
const {
  createRevertBatch,
  getRevertBatch,
  listRevertBatchesForSession,
  mapBatch,
  createRevertAllBatch,
  scheduleAsyncBatchProcessing,
  markBatchFailed,
  getBidHistory,
} = require('./revertBatch.service');
const { validateRevertBatchPayload } = require('./revertBatch.validator');

const gameSessionRepository = RepositoryFactory.getRepository('GameSession');
const marketRepository = RepositoryFactory.getRepository('Market');

/**
 * Resolve a marketId from either a MongoDB ObjectId string or a market code.
 * Allows the bid-history endpoint to accept both formats.
 */
const resolveMarketId = async (raw) => {
  const trimmed = String(raw).trim();
  if (/^[0-9a-fA-F]{24}$/.test(trimmed)) {
    return new mongoose.Types.ObjectId(trimmed);
  }
  const market = await marketRepository.findByCode(trimmed);
  if (!market) {
    throw new NotFoundError(`Market not found: ${trimmed}`);
  }
  return market._id;
};

/**
 * POST /admin/results/sessions/:sessionId/revert-batches
 *
 * Create a revert batch and enqueue it for async background processing.
 * Returns immediately — poll GET /admin/results/revert-batches/:batchId for status.
 */
const createAndExecuteRevertBatch = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const payload = validateRevertBatchPayload(req.body);
  const adminUserId = req.user?.id || req.admin?.id;

  const { batch, replayed } = await createRevertBatch({
    sessionId,
    ...payload,
    adminUserId,
  });

  if (replayed && batch.status === 'completed') {
    return sendSuccess(
      res,
      { batch: mapBatch(batch), replayed: true },
      'Revert batch already completed (idempotent replay)',
    );
  }

  if (replayed && (batch.status === 'processing' || batch.status === 'pending')) {
    return sendSuccess(
      res,
      { batch: mapBatch(batch), replayed: true },
      'Revert batch already exists and is being processed',
    );
  }

  try {
    await scheduleAsyncBatchProcessing(batch._id);
  } catch (err) {
    await markBatchFailed(batch._id, `Failed to schedule async processing: ${err.message}`);
    const failedBatch = await getRevertBatch(batch._id);
    return sendSuccess(
      res,
      { batch: mapBatch(failedBatch), replayed: false },
      'Revert batch created but scheduling failed — marked as failed. Retry with same idempotencyKey to resume.',
    );
  }

  return sendSuccess(
    res,
    { batch: mapBatch(batch), replayed: false },
    'Revert batch created and queued for async processing',
  );
});

/**
 * GET /admin/results/sessions/:sessionId/revert-batches
 *
 * List all revert batches for a session (newest first).
 */
const listRevertBatches = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const { items, total } = await listRevertBatchesForSession(sessionId, {
    page,
    limit,
  });

  sendSuccess(
    res,
    {
      items: items.map(mapBatch),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    },
    'Revert batch list fetched',
  );
});

/**
 * GET /admin/results/revert-batches/:batchId
 *
 * Fetch a single revert batch for status polling.
 */
const getRevertBatchStatus = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const batch = await getRevertBatch(batchId);
  sendSuccess(res, mapBatch(batch), 'Revert batch status fetched');
});

const listBidHistory = asyncHandler(async (req, res) => {
  const {
    sessionId,
    date,
    marketId: rawMarketId,
    page: rawPage,
    limit: rawLimit,
  } = req.query;
  const page = Math.max(Number(rawPage) || 1, 1);
  const limit = Math.min(Number(rawLimit) || 20, 100);

  let resolvedSessionId = sessionId;

  if (!resolvedSessionId && date && rawMarketId) {
    const resolvedMarketId = await resolveMarketId(rawMarketId);
    const session = await gameSessionRepository.findByMarketAndDateLean(
      resolvedMarketId,
      date,
    );
    if (!session) {
      throw new NotFoundError(
        'Session not found for the given date and market',
      );
    }
    resolvedSessionId = String(session._id);
  }

  if (!resolvedSessionId) {
    throw new ValidationError('Either sessionId or date+marketId is required');
  }

  const data = await getBidHistory(resolvedSessionId, page, limit);
  sendSuccess(res, data, 'Bid history fetched');
});

/**
 * POST /admin/results/sessions/:sessionId/revert-all
 *
 * Create a revert-all batch covering BOTH open and close bets (no phase filter)
 * and enqueue it for async background processing.
 *
 * Returns immediately with the batch reference — does NOT wait for execution.
 * Poll GET /admin/results/revert-batches/:batchId for status.
 */
const createAndEnqueueRevertAll = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const adminUserId = req.user?.id || req.admin?.id;

  const reason = String(req.body.reason || '').trim();
  if (!reason || reason.length < 3 || reason.length > 500) {
    throw new ValidationError('reason is required (3–500 characters)');
  }

  const idempotencyKey = String(req.body.idempotencyKey || '').trim();
  if (!idempotencyKey || idempotencyKey.length < 8) {
    throw new ValidationError('idempotencyKey is required (min 8 characters)');
  }

  const payload = {
    sessionId,
    reason,
    idempotencyKey,
    adminUserId,
  };

  if (req.body.note !== undefined) {
    payload.note = String(req.body.note || '').trim() || null;
  }

  const { batch, replayed } = await createRevertAllBatch(payload);

  // If replayed and already completed, return early
  if (replayed && batch.status === 'completed') {
    return sendSuccess(
      res,
      { batch: mapBatch(batch), replayed: true },
      'Revert-all batch already completed (idempotent replay)',
    );
  }

  // If batch is already queued or processing, return current state
  if (
    replayed &&
    (batch.status === 'processing' || batch.status === 'pending')
  ) {
    return sendSuccess(
      res,
      { batch: mapBatch(batch), replayed: true },
      'Revert-all batch already exists and is being processed',
    );
  }

  // Enqueue for async background processing
  try {
    await scheduleAsyncBatchProcessing(batch._id);
  } catch (err) {
    // Scheduling failed — mark batch as failed so retries are not blocked
    await markBatchFailed(batch._id, `Failed to schedule async processing: ${err.message}`);
    const failedBatch = await getRevertBatch(batch._id);
    return sendSuccess(
      res,
      { batch: mapBatch(failedBatch), replayed: false },
      'Revert-all batch created but scheduling failed — batch marked as failed. Retry with same idempotencyKey to resume.',
    );
  }

  return sendSuccess(
    res,
    { batch: mapBatch(batch), replayed: false },
    'Revert-all batch created and queued for async processing',
  );
});

module.exports = {
  createAndExecuteRevertBatch,
  listRevertBatches,
  getRevertBatchStatus,
  listBidHistory,
  createAndEnqueueRevertAll,
};
