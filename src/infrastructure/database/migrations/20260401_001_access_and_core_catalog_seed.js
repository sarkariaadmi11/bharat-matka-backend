const {
  Role,
  Permission,
  RolePermission,
  GameType,
  GlobalConfig,
} = require('@infra/models');
const rolesSeed = require('@config/seed-definitions/roles.seed');
const { permissions, rolePermissionMap } = require('@config/seed-definitions/permissions.seed');
const gameTypesSeed = require('@config/seed-definitions/gameTypes.seed');
const PREFIX = '[Migration:20260401_001]';

const summarizeMutation = (summary, kind) => {
  summary[kind] = (summary[kind] || 0) + 1;
};

const logAction = (message) => {
  console.log(`${PREFIX} ${message}`);
};

const syncRoles = async () => {
  const summary = { created: 0, updated: 0, skipped: 0 };

  for (const definition of rolesSeed) {
    const existing = await Role.findOne({ code: definition.code });
    if (!existing) {
      await Role.create(definition);
      summarizeMutation(summary, 'created');
      logAction(`Role ${definition.code} created`);
      continue;
    }

    const nextState = {
      name: definition.name,
      status: definition.status,
      isSystem: definition.isSystem,
    };

    const changed = existing.name !== nextState.name
      || existing.status !== nextState.status
      || existing.isSystem !== nextState.isSystem;

    if (!changed) {
      summarizeMutation(summary, 'skipped');
      logAction(`Role ${definition.code} skipped`);
      continue;
    }

    await Role.updateOne({ _id: existing._id }, { $set: nextState });
    summarizeMutation(summary, 'updated');
    logAction(`Role ${definition.code} updated`);
  }

  return summary;
};

const syncPermissions = async () => {
  const summary = { created: 0, updated: 0, skipped: 0 };

  for (const definition of permissions) {
    const existing = await Permission.findOne({ code: definition.code });
    if (!existing) {
      await Permission.create(definition);
      summarizeMutation(summary, 'created');
      logAction(`Permission ${definition.code} created`);
      continue;
    }

    if (existing.description === definition.description) {
      summarizeMutation(summary, 'skipped');
      logAction(`Permission ${definition.code} skipped`);
      continue;
    }

    await Permission.updateOne(
      { _id: existing._id },
      { $set: { description: definition.description } },
    );
    summarizeMutation(summary, 'updated');
    logAction(`Permission ${definition.code} updated`);
  }

  return summary;
};

const syncRolePermissions = async () => {
  const summary = { created: 0, updated: 0, skipped: 0 };
  const roles = await Role.find({ code: { $in: Object.keys(rolePermissionMap) } }).lean();
  const permissionsList = await Permission.find({ code: { $in: permissions.map((item) => item.code) } }).lean();
  const permissionsByCode = new Map(
    permissionsList.map((item) => [item.code, item]),
  );
  const permissionCodesById = new Map(
    permissionsList.map((item) => [String(item._id), item.code]),
  );
  const rolesByCode = new Map(roles.map((item) => [item.code, item]));

  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMap)) {
    const role = rolesByCode.get(roleCode);
    if (!role) {
      throw new Error(`Missing role for permission sync: ${roleCode}`);
    }

    const permissionIds = permissionCodes.map((permissionCode) => {
      const permission = permissionsByCode.get(permissionCode);
      if (!permission) {
        throw new Error(`Missing permission for role sync: ${permissionCode}`);
      }
      return String(permission._id);
    }).sort();

    const existing = await RolePermission.find({ roleId: role._id }).lean();
    const existingIds = new Set(existing.map((item) => String(item.permissionId)));
    const desiredIds = new Set(permissionIds);

    for (const permissionCode of permissionCodes) {
      const permissionId = String(permissionsByCode.get(permissionCode)._id);
      if (existingIds.has(permissionId)) {
        summarizeMutation(summary, 'skipped');
        logAction(`RolePermission ${roleCode}->${permissionCode} skipped`);
        continue;
      }

      await RolePermission.create({
        roleId: role._id,
        permissionId,
      });
      summarizeMutation(summary, 'created');
      logAction(`RolePermission ${roleCode}->${permissionCode} created`);
    }

    const stalePermissions = existing.filter((item) => !desiredIds.has(String(item.permissionId)));
    if (stalePermissions.length > 0) {
      await RolePermission.deleteMany({
        roleId: role._id,
        permissionId: { $in: stalePermissions.map((item) => item.permissionId) },
      });

      stalePermissions.forEach((item) => {
        summarizeMutation(summary, 'updated');
        logAction(
          `RolePermission ${roleCode}->${permissionCodesById.get(String(item.permissionId)) || String(item.permissionId)} updated`,
        );
      });
    }
  }

  return summary;
};

const syncGameTypes = async () => {
  const summary = { created: 0, updated: 0, skipped: 0 };

  for (const definition of gameTypesSeed) {
    const existing = await GameType.findOne({ code: definition.code });
    const nextState = {
      code: definition.code,
      name: definition.name,
      templateKey: definition.templateKey,
      payoutMultiplier: definition.payoutMultiplier,
      status: definition.status,
      rulesVersion: definition.version || 1,
    };

    if (!existing) {
      await GameType.create(nextState);
      summarizeMutation(summary, 'created');
      logAction(`GameType ${definition.code} created`);
      continue;
    }

    const changed = existing.name !== nextState.name
      || existing.templateKey !== nextState.templateKey
      || Number(existing.payoutMultiplier) !== Number(nextState.payoutMultiplier)
      || existing.status !== nextState.status;

    if (!changed) {
      summarizeMutation(summary, 'skipped');
      logAction(`GameType ${definition.code} skipped`);
      continue;
    }

    await GameType.findOneAndUpdate(
      { _id: existing._id },
      { $set: nextState },
      { new: true, runValidators: true },
    );
    summarizeMutation(summary, 'updated');
    logAction(`GameType ${definition.code} updated`);
  }

  return summary;
};

const ensureGlobalConfig = async () => {
  const summary = { created: 0, updated: 0, skipped: 0 };
  const existing = await GlobalConfig.findOne().lean();
  if (existing) {
    summarizeMutation(summary, 'skipped');
    logAction('GlobalConfig skipped');
    return summary;
  }

  await GlobalConfig.create({});
  summarizeMutation(summary, 'created');
  logAction('GlobalConfig created');
  return summary;
};

module.exports = {
  name: '20260401_001_access_and_core_catalog_seed',
  up: async () => {
    const roleSummary = await syncRoles();
    const permissionSummary = await syncPermissions();
    const rolePermissionSummary = await syncRolePermissions();
    const gameTypeSummary = await syncGameTypes();
    const configSummary = await ensureGlobalConfig();

    console.log(`${PREFIX} Summary`, {
      roles: roleSummary,
      permissions: permissionSummary,
      rolePermissions: rolePermissionSummary,
      gameTypes: gameTypeSummary,
      globalConfig: configSummary,
    });
  },
  down: async () => {
    throw new Error('Down migrations are not supported for fresh-cluster seed migrations.');
  },
};
