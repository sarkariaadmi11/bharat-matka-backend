/**
 * UserDevice Repository
 * ---------------------
 * Encapsulates all database operations for device tokens.
 * This keeps data access separate from business logic.
 */

const BaseRepository = require('./baseRepository');
const { UserDevice } = require('@infra/models');
const logger = require('@utils/logger');

class UserDeviceRepository extends BaseRepository {
  constructor() {
    super(UserDevice);
  }

  /**
   * Upsert a device token for a user.
   * If the token exists, it is re-associated to the user and updated.
   */
  async upsertDevice({ userId, fcmToken, deviceType, appVersion }) {
    return await this.model.findOneAndUpdate(
      { fcmToken },
      {
        $set: {
          userId,
          deviceType,
          appVersion,
          isActive: true,
        },
      },
      { new: true, upsert: true },
    );
  }

  /**
   * Update an existing token to a new value (token rotation).
   */
  async updateToken({ userId, oldToken, newToken, deviceType, appVersion }) {
    return await this.model.findOneAndUpdate(
      { userId, fcmToken: oldToken },
      {
        $set: {
          fcmToken: newToken,
          deviceType,
          appVersion,
          isActive: true,
        },
      },
      { new: true },
    );
  }

  /**
   * Deactivate a token for a user without deleting the record.
   * This preserves history and avoids duplicate device records.
   */
  async deactivateToken({ userId, fcmToken }) {
    return await this.model.findOneAndUpdate(
      { userId, fcmToken },
      { $set: { isActive: false } },
      { new: true },
    );
  }

  /**
   * Fetch all active tokens for a set of users.
   */
  async findActiveTokensByUserIds(userIds) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      logger.warn({
        message: 'No user IDs provided for token lookup',
      });
      return [];
    }

    const devices = await this.model
      .find({ userId: { $in: userIds }, isActive: true })
      .select('fcmToken')
      .lean();

    const tokens = devices.map((d) => d.fcmToken).filter(Boolean);
    if (tokens.length === 0) {
      logger.warn({
        message: 'No active device tokens found for provided user IDs',
        userCount: userIds.length,
      });
    }

    return tokens;
  }

  /**
   * Fetch all active tokens subscribed to a market.
   */
  async findActiveTokensByMarketCode(marketCode) {
    if (marketCode) {
      logger.debug({
        message: 'Market subscription targeting is disabled; using all active tokens',
        marketCode,
      });
    }

    const devices = await this.model
      .find({ isActive: true })
      .select('fcmToken')
      .lean();

    const tokens = devices.map((d) => d.fcmToken).filter(Boolean);
    if (tokens.length === 0) {
      logger.warn({
        message: 'No active device tokens found for notification dispatch',
        marketCode: marketCode || null,
      });
    }

    return tokens;
  }

  /**
   * Mark invalid tokens as inactive to keep the database clean.
   */
  async deactivateTokens(tokens) {
    if (!tokens || tokens.length === 0) {
      return { matchedCount: 0, modifiedCount: 0 };
    }
    return await this.model.updateMany(
      { fcmToken: { $in: tokens } },
      { $set: { isActive: false } },
    );
  }
}

module.exports = UserDeviceRepository;

