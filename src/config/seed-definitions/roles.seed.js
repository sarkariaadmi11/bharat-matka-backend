const ROLES = require('@config/constants/roles');
const { MARKET_STATUS } = require('@config/constants/domain');

module.exports = Object.freeze([
  {
    code: ROLES.USER,
    name: 'User',
    status: MARKET_STATUS.ACTIVE,
    isSystem: true,
  },
  {
    code: ROLES.ADMIN,
    name: 'Administrator',
    status: MARKET_STATUS.ACTIVE,
    isSystem: true,
  },
  {
    code: ROLES.SUPERADMIN,
    name: 'Super Administrator',
    status: MARKET_STATUS.ACTIVE,
    isSystem: true,
  },
]);
