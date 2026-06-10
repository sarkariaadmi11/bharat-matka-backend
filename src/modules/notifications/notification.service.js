const config = require('@config');
const { RepositoryFactory } = require('@infra/database');
const { BET_MODE, NOTIFICATION_EVENT } = require('@config/constants/domain');
const { ValidationError } = require('@utils/errors');
const logger = require('@utils/logger');
const FCMProvider = require('./providers/FCMProvider');

const INVALID_FCM_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

class NotificationService {
  constructor({
    deviceRepository,
    gameSessionRepository,
    marketRepository,
    providers,
    log = logger,
  } = {}) {
    this.logger = log;
    this.deviceRepository = deviceRepository || RepositoryFactory.getRepository('UserDevice');
    this.gameSessionRepository = gameSessionRepository || RepositoryFactory.getRepository('GameSession');
    this.marketRepository = marketRepository || RepositoryFactory.getRepository('Market');

    this.providers = providers || new Map();
    if (!this.providers.has('push')) {
      this.providers.set('push', new FCMProvider({ config, logger: this.logger }));
    }
  }

  registerProvider(channel, provider) {
    this.providers.set(channel, provider);
  }

  async registerDevice({
    userId,
    fcmToken,
    deviceType = 'unknown',
    appVersion = 'unknown',
  }) {
    if (!userId || !fcmToken) {
      throw new ValidationError('userId and fcmToken are required');
    }

    return this.deviceRepository.upsertDevice({
      userId,
      fcmToken: fcmToken.trim(),
      deviceType,
      appVersion,
    });
  }

  async updateDeviceToken({
    userId,
    oldToken,
    newToken,
    deviceType = 'unknown',
    appVersion = 'unknown',
  }) {
    if (!userId || !oldToken || !newToken) {
      throw new ValidationError('userId, oldToken and newToken are required');
    }

    if (oldToken === newToken) {
      throw new ValidationError('oldToken and newToken must be different');
    }

    const updated = await this.deviceRepository.updateToken({
      userId,
      oldToken: oldToken.trim(),
      newToken: newToken.trim(),
      deviceType,
      appVersion,
    });

    if (!updated) {
      throw new ValidationError('Device token not found for this user');
    }

    return updated;
  }

  async removeDevice({ userId, fcmToken }) {
    if (!userId || !fcmToken) {
      throw new ValidationError('userId and fcmToken are required');
    }

    const removed = await this.deviceRepository.deactivateToken({
      userId,
      fcmToken: fcmToken.trim(),
    });

    if (!removed) {
      throw new ValidationError('Device token not found for this user');
    }

    return removed;
  }

  async sendToUser(userId, payload) {
    if (!userId) {
      throw new ValidationError('userId is required');
    }
    return this.sendToUsers([userId], payload);
  }

  async sendToUsers(userIds, payload) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new ValidationError('userIds is required');
    }
    const tokens = await this.deviceRepository.findActiveTokensByUserIds(userIds);
    return this._sendPushToTokens(tokens, payload);
  }

  async sendToMarketSubscribers(marketCode, payload) {
    if (!marketCode) {
      throw new ValidationError('marketCode is required');
    }
    const tokens = await this.deviceRepository.findActiveTokensByMarketCode(marketCode);
    return this._sendPushToTokens(tokens, payload);
  }

  async notifyMarketResultDeclared(input) {
    const normalizedInput = typeof input === 'object' && input !== null
      ? input
      : { sessionId: input, phase: BET_MODE.CLOSE };

    const { sessionId } = normalizedInput;
    const phase = normalizedInput.phase || BET_MODE.CLOSE;

    if (!sessionId) {
      throw new ValidationError('sessionId is required');
    }

    const session = await this.gameSessionRepository.findLeanById(sessionId);
    const market = session?.marketId
      ? await this.marketRepository.findLeanById(session.marketId, 'code name')
      : null;

    const marketCode = market?.code || null;
    const marketName = market?.name || marketCode || null;

    if (!marketCode || !marketName) {
      this.logger.warn({
        message: 'Unable to resolve marketCode for notification',
        sessionId,
      });
      return { skipped: true, successCount: 0, failureCount: 0, responses: [] };
    }
    const openPana = session?.result?.openPana || '';
    const openDigit = session?.result?.openDigit;
    const closePana = session?.result?.closePana || '';
    const closeDigit = session?.result?.closeDigit;

    const openResult = openPana && openDigit !== null && openDigit !== undefined
      ? `${openPana}-${openDigit}`
      : '';
    const closeResult = closePana && closeDigit !== null && closeDigit !== undefined
      ? `${closePana}-${closeDigit}`
      : '';

    const body = phase === BET_MODE.OPEN
      ? openResult
      : `${openResult} ${closeResult}`.trim();

    const payload = {
      title: `${marketName} Result Declared`,
      body,
      data: {
        event: NOTIFICATION_EVENT.RESULT_DECLARED,
        sessionId: String(sessionId),
        marketCode,
        phase,
      },
    };

    return this.sendToMarketSubscribers(marketCode, payload);
  }

  async _sendPushToTokens(tokens, payload) {
    const provider = this.providers.get('push');

    if (!provider) {
      this.logger.warn({ message: 'Push provider not configured' });
      return { skipped: true, successCount: 0, failureCount: 0, responses: [] };
    }

    const result = await provider.sendToTokens({
      tokens,
      notification: {
        title: payload?.title || 'Notification',
        body: payload?.body || '',
      },
      data: payload?.data || {},
    });

    await this._cleanupInvalidTokens(result.responses);

    return result;
  }

  async _cleanupInvalidTokens(responses) {
    if (!Array.isArray(responses) || responses.length === 0) {
      return;
    }

    const invalidTokens = responses
      .filter((res) => !res.success && res.error?.code && INVALID_FCM_ERROR_CODES.has(res.error.code))
      .map((res) => res.token);

    if (invalidTokens.length === 0) {
      return;
    }

    try {
      await this.deviceRepository.deactivateTokens(invalidTokens);
    } catch (error) {
      this.logger.error({
        message: 'Failed to deactivate invalid FCM tokens',
        error,
      });
    }
  }
}

const notificationService = new NotificationService();

module.exports = notificationService;
module.exports.NotificationService = NotificationService;

