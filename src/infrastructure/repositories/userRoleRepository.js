const BaseRepository = require('./baseRepository');
const { UserRole, Role } = require('@infra/models');

class UserRoleRepository extends BaseRepository {
  constructor() {
    super(UserRole);
  }

  async assignRole({
    userId,
    roleId,
    isPrimary = false,
    assignedBy = null,
  }, session = null) {
    if (isPrimary) {
      await this.model.updateMany(
        { userId, isPrimary: true },
        { $set: { isPrimary: false, updatedAt: new Date() } },
        { session },
      );
    }

    return this.model.findOneAndUpdate(
      { userId, roleId },
      {
        $set: {
          isPrimary,
          assignedBy,
          assignedAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        session,
      },
    );
  }

  async findRoleLinksByUserId(userId, session = null) {
    return this.model
      .find({ userId })
      .populate('roleId', 'code name status')
      .sort({ isPrimary: -1, createdAt: 1 })
      .session(session);
  }

  async getRoleContextByUserId(userId, session = null) {
    const links = await this.findRoleLinksByUserId(userId, session);
    const roles = links
      .map((link) => link.roleId)
      .filter(Boolean);
    const primaryRole = roles[0] || null;

    return {
      primaryRole,
      roles,
      roleCodes: roles.map((role) => role.code),
    };
  }

  async attachPrimaryRoles(users = [], session = null) {
    if (!Array.isArray(users) || users.length === 0) {
      return users;
    }

    const ids = users
      .map((user) => user?._id)
      .filter(Boolean);

    if (ids.length === 0) {
      return users;
    }

    const links = await this.model
      .find({ userId: { $in: ids } })
      .populate('roleId', 'code name status')
      .sort({ isPrimary: -1, createdAt: 1 })
      .session(session);

    const byUserId = new Map();
    links.forEach((link) => {
      const key = String(link.userId);
      if (!byUserId.has(key) && link.roleId) {
        byUserId.set(key, link.roleId);
      }
    });

    users.forEach((user) => {
      if (user) {
        user.role = byUserId.get(String(user._id)) || null;
      }
    });

    return users;
  }

  async findUsersByRoleCode(roleCode, session = null) {
    return this.model.aggregate([
      {
        $lookup: {
          from: Role.collection.name,
          localField: 'roleId',
          foreignField: '_id',
          as: 'role',
        },
      },
      { $unwind: '$role' },
      { $match: { 'role.code': roleCode } },
    ]).session(session);
  }
}

module.exports = UserRoleRepository;
