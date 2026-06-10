const ROLES = require('@config/constants/roles');

const normalizeValues = (values = []) => new Set(
  (Array.isArray(values) ? values : [values])
    .filter(Boolean)
    .map((value) => String(value).trim().toUpperCase()),
);

const resolveRoles = (user = {}) => {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const primaryRole = user.role ? [user.role] : [];
  return normalizeValues([...roles, ...primaryRole]);
};

const resolvePermissions = (user = {}) => normalizeValues(user.permissions || []);

const hasSuperAdminAccess = (user = {}) => resolveRoles(user).has(ROLES.SUPERADMIN);

const isAuthorized = (user = {}, { anyRole = [], anyPermission = [] } = {}) => {
  if (!user) {
    return false;
  }

  if (hasSuperAdminAccess(user)) {
    return true;
  }

  const requiredRoles = normalizeValues(anyRole);
  const requiredPermissions = normalizeValues(anyPermission);
  const currentRoles = resolveRoles(user);
  const currentPermissions = resolvePermissions(user);

  if (requiredRoles.size === 0 && requiredPermissions.size === 0) {
    return true;
  }

  const roleMatch = [...requiredRoles].some((role) => currentRoles.has(role));
  const permissionMatch = [...requiredPermissions].some((permission) => currentPermissions.has(permission));

  return roleMatch || permissionMatch;
};

module.exports = {
  hasSuperAdminAccess,
  isAuthorized,
};
