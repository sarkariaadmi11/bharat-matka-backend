/**
 * Validation for revert batch request payloads.
 * Uses the same inline-validation pattern as result.validator.js.
 */
const { ValidationError } = require('@utils/errors');

/**
 * Validate and normalise the body of the create-revert-batch request.
 *
 * Fields:
 *   reason         (required) — 3–500 chars; recorded on the batch and each bet
 *   note           (optional) — additional free-text for the admin log
 *   idempotencyKey (required) — caller-supplied key; prevents duplicate batches
 *                               on network retries
 */
const validateRevertBatchPayload = (body = {}) => {
  const reason = String(body.reason || '').trim();
  if (!reason) {
    throw new ValidationError('reason is required');
  }
  if (reason.length < 3) {
    throw new ValidationError('reason must be at least 3 characters');
  }
  if (reason.length > 500) {
    throw new ValidationError('reason must not exceed 500 characters');
  }

  const idempotencyKey = String(body.idempotencyKey || '').trim();
  if (!idempotencyKey) {
    throw new ValidationError('idempotencyKey is required for revert batch safety');
  }
  if (idempotencyKey.length < 8) {
    throw new ValidationError('idempotencyKey must be at least 8 characters');
  }

  const payload = { reason, idempotencyKey };

  if (body.note !== undefined) {
    payload.note = String(body.note || '').trim() || null;
  }

  return payload;
};

module.exports = { validateRevertBatchPayload };
