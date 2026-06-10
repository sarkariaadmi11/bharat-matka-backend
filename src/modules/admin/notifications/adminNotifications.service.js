const { RepositoryFactory } = require('@infra/database');
const { ValidationError } = require('@utils/errors');
const notificationService = require('@modules/notifications/notification.service');

const userRepository = RepositoryFactory.getRepository('User');

const sendNotification = async ({
  title,
  body,
  userIds = [],
  sendToAll = false,
  data = {},
}) => {
  const targetUserIds = await userRepository.findNotificationTargetIds({
    sendToAll,
    userIds,
  });

  if (!targetUserIds.length) {
    throw new ValidationError('Provide userIds or enable sendToAll');
  }

  const result = await notificationService.sendToUsers(targetUserIds, {
    title,
    body,
    data,
  });

  return {
    recipients: targetUserIds.length,
    successCount: result.successCount || 0,
    failureCount: result.failureCount || 0,
    skipped: !!result.skipped,
  };
};

module.exports = {
  sendNotification,
};
