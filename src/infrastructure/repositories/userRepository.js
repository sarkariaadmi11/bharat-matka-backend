/**
 * User Repository - Refactored for Compliance & Soft-Delete
 * This is the operational layer for user management.
 */

const BaseRepository = require('./baseRepository');
const { User } = require('@infra/models');
const { USER_STATUS } = require('@config/constants/domain');
const mongoose = require('mongoose');
const { buildPagination } = require('@utils/pagination');
const UserRoleRepository = require('./userRoleRepository');

const userRoleRepository = new UserRoleRepository();

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  /**
   * Overriding findById to respect soft-delete by default
   */
  async findById(id) {
    const user = await this.model.findOne({ _id: id, deletedAt: null });
    if (!user) {
      throw new Error('User not found or has been deleted');
    }
    await userRoleRepository.attachPrimaryRoles([user]);
    return user;
  }

  /**
   * Find by Username (Optimized for active users)
   */
  async findByUsername(username) {
    return await this.model.findOne({
      username,
      deletedAt: null,
    });
  }

  /**
   * Compliance: Handle Self-Exclusion Logic
   * Checks if a user is currently in a self-imposed cooling-off period.
   */
  async checkSelfExclusion(userId) {
    const user = await this.model.findById(userId).select('compliance.selfExclusion');
    if (!user) {
      return false;
    }

    const { enabled, to } = user.compliance.selfExclusion;
    if (enabled && to && new Date() < to) {
      return { excluded: true, until: to };
    }
    return { excluded: false };
  }

  /**
   * Compliance: Soft Delete (Legal requirement to keep data but hide it)
   */
  async softDelete(userId) {
    return await this.update(userId, {
      deletedAt: new Date(),
      status: USER_STATUS.INACTIVE,
    });
  }

  /**
   * Search users by phone (Common for Admin support)
   */
  async findByPhone(phone) {
    return await this.model.findOne({ phone, deletedAt: null });
  }

  /**
   * Advanced Search: Filter by Compliance Status
   * Useful for Admin Dashboard to see unverified users
   */
  async findUnverifiedUsers(page = 1, limit = 10) {
    const filter = {
      isVerified: false,
      deletedAt: null,
    };
    return await this.findByFilter(filter, page, limit);
  }

  /**
   * Update Metadata
   * Safely merges new flags into the mixed metadata field
   */
  async updateMetadata(userId, newMetadata) {
    return await this.model.findByIdAndUpdate(
      userId,
      { $set: { metadata: newMetadata } },
      { new: true },
    );
  }

  async findForAdminList({
    search,
    status,
    sortBy = 'createdAt',
    order = 'desc',
    query = {},
  }) {
    const { skip, limit, page } = buildPagination(query);
    const filter = { deletedAt: null };
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) {
      filter.status = status;
    }

    const direction = order === 'asc' ? 1 : -1;
    const allowedSorts = new Set(['createdAt', 'updatedAt', 'lastLoginAt', 'username']);
    const resolvedSortBy = allowedSorts.has(sortBy) ? sortBy : 'createdAt';

    const [documents, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ [resolvedSortBy]: direction })
        .skip(skip)
        .limit(limit),
      this.model.countDocuments(filter),
    ]);

    await userRoleRepository.attachPrimaryRoles(documents);

    return { documents, total, page, limit };
  }

  async findAdminDetailsById(userId) {
    const user = await this.model
      .findOne({
        _id: userId,
        deletedAt: null,
      });

    if (user) {
      await userRoleRepository.attachPrimaryRoles([user]);
    }

    return user;
  }

  async findProfileById(userId) {
    return this.model
      .findById(userId)
      .where({ deletedAt: null })
      .select('-password -refreshTokenHash -passwordResetTokenHash -lastLoginAt -compliance');
  }

  async updateProfileById(userId, payload) {
    return this.model
      .findOneAndUpdate(
        { _id: userId, deletedAt: null },
        { $set: payload },
        { new: true, runValidators: true, context: 'query' },
      )
      .select('-password -refreshTokenHash -passwordResetTokenHash');
  }

  async findActiveUsersByIds(userIds, projection = null) {
    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
    if (ids.length === 0) {
      return [];
    }

    let query = this.model.find({
      _id: { $in: ids },
      deletedAt: null,
      status: USER_STATUS.ACTIVE,
    });

    if (projection) {
      query = query.select(projection);
    }

    return query.lean();
  }

  async findNotificationTargetIds({ sendToAll = false, userIds = [] } = {}) {
    const filter = { deletedAt: null };

    if (!sendToAll) {
      const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
      if (ids.length === 0) {
        return [];
      }
      filter._id = { $in: ids };
    }

    const users = await this.model.find(filter).select('_id').lean();
    return users.map((user) => String(user._id));
  }

  async setStatus(userId, status, { revokeRefreshToken = false } = {}) {
    const update = {
      status,
      updatedAt: new Date(),
    };

    if (revokeRefreshToken) {
      update.refreshTokenHash = null;
    }

    return this.model.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      { $set: update },
      { new: true, runValidators: true },
    );
  }

  async existsActiveById(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return false;
    }

    const found = await this.model.exists({
      _id: userId,
      deletedAt: null,
      status: USER_STATUS.ACTIVE,
    });

    return !!found;
  }
}

module.exports = UserRepository;

