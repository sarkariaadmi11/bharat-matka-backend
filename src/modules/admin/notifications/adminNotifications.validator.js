const mongoose = require('mongoose');
const { ValidationError } = require('@utils/errors');

const ensureObjectId = (value, label = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ValidationError(`Invalid ${label}`);
  }
};

const validateNotificationPayload = (payload = {}) => {
  const title = String(payload.title || '').trim();
  const body = String(payload.body || '').trim();

  if (!title) {
    throw new ValidationError('title is required');
  }

  if (!body) {
    throw new ValidationError('body is required');
  }

  const userIds = Array.isArray(payload.userIds)
    ? payload.userIds.filter(Boolean).map((item) => String(item))
    : [];

  userIds.forEach((userId) => ensureObjectId(userId, 'user id'));

  return {
    title,
    body,
    userIds,
    sendToAll: payload.sendToAll === true,
    data: payload.data && typeof payload.data === 'object' ? payload.data : {},
  };
};

module.exports = {
  validateNotificationPayload,
};
