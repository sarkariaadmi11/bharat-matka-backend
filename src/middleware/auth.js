const jwt = require('jsonwebtoken');
const { RepositoryFactory } = require('@infra/database');
const ROLES = require('@config/constants/roles');
const { USER_STATUS } = require('@config/constants/domain');
const { UnauthorizedError } = require('@utils/errors');
const { isAuthorized } = require('@modules/auth/authorization.service');

const userRepository = RepositoryFactory.getRepository('User');
const userRoleRepository = RepositoryFactory.getRepository('UserRole');
const rolePermissionRepository = RepositoryFactory.getRepository('RolePermission');

const normalizeRoles = (roles = []) => [...new Set(
  (Array.isArray(roles) ? roles : [roles])
    .filter(Boolean)
    .map((role) => String(role).trim().toUpperCase()),
)];

/**
 * requireAuth
 * Verifies access token and attaches user to request
 */
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Authorization token missing'));
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'access-secret');
    } catch {
      return next(new UnauthorizedError('Invalid or expired token'));
    }

    const user = await userRepository.findById(decoded.sub);
    if (!user || user.deletedAt) {
      return next(new UnauthorizedError('Account not found'));
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      return next(new UnauthorizedError('Account is not active'));
    }

    const roleContext = await userRoleRepository.getRoleContextByUserId(user._id);
    const roleIds = roleContext.roles.map((role) => role._id);
    const permissionCodes = await rolePermissionRepository.getPermissionCodesByRoleIds(roleIds);
    const tokenRoles = normalizeRoles(decoded.roles);
    const contextRoles = normalizeRoles(roleContext.roleCodes);
    const resolvedRoles = contextRoles.length > 0
      ? contextRoles
      : (tokenRoles.length > 0 ? tokenRoles : normalizeRoles(decoded.role));
    const primaryRole = normalizeRoles(
      roleContext.primaryRole?.code || decoded.role || resolvedRoles[0],
    )[0] || '';

    req.user = {
      id: user._id,
      role: primaryRole,
      roles: resolvedRoles,
      permissions: permissionCodes,
      isVerified: user.isVerified,
    };

    next();
  } catch (error) {
    next(error);
  }
};

const authorize = ({ anyRole = [], anyPermission = [] } = {}) => async (req, res, next) => {
  try {
    if (!req.user) {
      return next(new UnauthorizedError('Access denied'));
    }

    if (!isAuthorized(req.user, { anyRole, anyPermission })) {
      return next(new UnauthorizedError('Admin access required'));
    }

    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = authorize({ anyRole: [ROLES.ADMIN] });

module.exports = {
  authorize,
  requireAdmin,
  requireAuth,
  requireAdminAuth: [requireAuth, requireAdmin],
};
