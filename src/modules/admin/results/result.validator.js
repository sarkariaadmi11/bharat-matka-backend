const { ValidationError } = require('@utils/errors');

const validateOpenPayload = (body = {}) => {
  if (!body.openPana) {
    throw new ValidationError('openPana is required');
  }
};

const validateClosePayload = (body = {}) => {
  if (!body.closePana) {
    throw new ValidationError('closePana is required');
  }
};

const validateResetPayload = (body = {}) => {
  const reason = String(body.reason || '').trim();
  if (!reason) {
    throw new ValidationError('reason is required');
  }

  const payload = {
    reason,
  };

  if (body.note !== undefined) {
    payload.note = String(body.note || '').trim() || null;
  }

  if (body.expectedResultRevision !== undefined) {
    const expectedResultRevision = Number(body.expectedResultRevision);
    if (!Number.isInteger(expectedResultRevision) || expectedResultRevision < 0) {
      throw new ValidationError('expectedResultRevision must be a non-negative integer');
    }
    payload.expectedResultRevision = expectedResultRevision;
  }

  return payload;
};

module.exports = {
  validateOpenPayload,
  validateClosePayload,
  validateResetOpenPayload: validateResetPayload,
  validateResetClosePayload: validateResetPayload,
};
