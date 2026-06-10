const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils/response');
const notificationService = require('./notification.service');

const registerDevice = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { fcmToken, deviceType, appVersion } = req.body || {};

  const device = await notificationService.registerDevice({
    userId,
    fcmToken,
    deviceType,
    appVersion,
  });

  sendSuccess(res, device, 'Device registered');
});

const updateDeviceToken = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { oldToken, newToken, deviceType, appVersion } = req.body || {};

  const device = await notificationService.updateDeviceToken({
    userId,
    oldToken,
    newToken,
    deviceType,
    appVersion,
  });

  sendSuccess(res, device, 'Device token updated');
});

const removeDevice = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  const { fcmToken } = req.body || {};

  const device = await notificationService.removeDevice({
    userId,
    fcmToken,
  });

  sendSuccess(res, device, 'Device removed');
});

module.exports = {
  registerDevice,
  updateDeviceToken,
  removeDevice,
};
