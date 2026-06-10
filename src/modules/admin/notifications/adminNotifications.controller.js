const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils/response');
const service = require('./adminNotifications.service');
const { validateNotificationPayload } = require('./adminNotifications.validator');

const sendNotification = asyncHandler(async (req, res) => {
  const result = await service.sendNotification(validateNotificationPayload(req.body));
  sendSuccess(res, result, 'Notification sent');
});

module.exports = {
  sendNotification,
};
