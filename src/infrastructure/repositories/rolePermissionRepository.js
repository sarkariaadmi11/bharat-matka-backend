const BaseRepository = require('./baseRepository');
const { RolePermission } = require('@infra/models');

class RolePermissionRepository extends BaseRepository {
  constructor() {
    super(RolePermission);
  }

  async syncRolePermissions(roleId, permissionIds = [], session = null) {
    await this.model.deleteMany({ roleId }).session(session);

    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return [];
    }

    const payload = permissionIds.map((permissionId) => ({
      roleId,
      permissionId,
    }));

    return this.model.insertMany(payload, { session, ordered: false });
  }

  async getPermissionCodesByRoleIds(roleIds = [], session = null) {
    if (!Array.isArray(roleIds) || roleIds.length === 0) {
      return [];
    }

    const documents = await this.model
      .find({ roleId: { $in: roleIds } })
      .populate('permissionId', 'code')
      .session(session);

    return [...new Set(
      documents
        .map((document) => document.permissionId?.code)
        .filter(Boolean),
    )];
  }
}

module.exports = RolePermissionRepository;
