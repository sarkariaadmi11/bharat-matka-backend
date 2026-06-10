const { PERMISSION_CODE } = require('@config/constants/permissions');
const ROLES = require('@config/constants/roles');

const permissions = Object.freeze([
  {
    code: PERMISSION_CODE.ADMIN_ACCESS,
    description: 'Access administrative routes and operations.',
  },
  {
    code: PERMISSION_CODE.USER_MANAGE,
    description: 'Manage user status, funds, and support actions.',
  },
  {
    code: PERMISSION_CODE.MARKET_MANAGE,
    description: 'Manage markets and market/game-type assignments.',
  },
  {
    code: PERMISSION_CODE.GAME_TYPE_MANAGE,
    description: 'Manage game-type configuration.',
  },
  {
    code: PERMISSION_CODE.RESULT_DECLARE,
    description: 'Declare and simulate results.',
  },
  {
    code: PERMISSION_CODE.PAYMENT_MANAGE,
    description: 'Approve payouts and manage payment-related settings.',
  },
  {
    code: PERMISSION_CODE.REPORT_VIEW,
    description: 'View administrative reporting data.',
  },
  {
    code: PERMISSION_CODE.NOTIFICATION_SEND,
    description: 'Send administrative notifications.',
  },
]);

const rolePermissionMap = Object.freeze({
  [ROLES.USER]: [],
  [ROLES.ADMIN]: [
    PERMISSION_CODE.ADMIN_ACCESS,
    PERMISSION_CODE.USER_MANAGE,
    PERMISSION_CODE.MARKET_MANAGE,
    PERMISSION_CODE.GAME_TYPE_MANAGE,
    PERMISSION_CODE.RESULT_DECLARE,
    PERMISSION_CODE.PAYMENT_MANAGE,
    PERMISSION_CODE.REPORT_VIEW,
    PERMISSION_CODE.NOTIFICATION_SEND,
  ],
  [ROLES.SUPERADMIN]: Object.values(PERMISSION_CODE),
});

module.exports = {
  permissions,
  rolePermissionMap,
};
