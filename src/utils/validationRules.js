/**
 * Validation Rules Schema
 * Defines validation rules for each endpoint
 */
const { USER_STATUS } = require('@config/constants/domain');

const validationRules = {
  // Auth validation rules
  auth: {
    register: {
      username: { required: true, type: 'string', min: 2, max: 100 },
      email: { required: false, type: 'email' },
      phone: { required: true, type: 'string', pattern: /^[0-9]{10}$/, unique: true },
      password: { required: true, type: 'string', min: 6, max: 50 },
      confirmPassword: { required: true, type: 'string', min: 6, max: 50, matches: 'password' },
    },
    login: {
      phone: { required: true, type: 'string', pattern: /^[0-9]{10}$/ },
      password: { required: true, type: 'string', min: 6 },
    },
    refreshToken: {
      refreshToken: { required: true, type: 'string' },
    },
    forgotPassword: {
      phone: { required: true, type: 'string', pattern: /^[0-9]{10}$/ },
    },
    resetPassword: {
      resetToken: { required: true, type: 'string' },
      newPassword: { required: true, type: 'string', min: 6, max: 50 },
      confirmPassword: { required: true, type: 'string', min: 6, max: 50 },
    },
    verifyEmail: {
      userId: { required: true, type: 'string' },
      verificationToken: { required: true, type: 'string' },
    },
  },
  // User validation rules
  user: {
    create: {
      username: { required: true, type: 'string', min: 2, max: 100 },
      email: { required: false, type: 'email' },
      phone: { required: true, type: 'string', pattern: /^[0-9]{10}$/, unique: true },
      status: { required: false, type: 'string', enum: Object.values(USER_STATUS) },
    },
    update: {
      username: { required: false, type: 'string', min: 2, max: 100 },
      email: { required: false, type: 'email' },
      phone: { required: false, type: 'string', pattern: /^[0-9]{10}$/ },
      status: { required: false, type: 'string', enum: Object.values(USER_STATUS) },
    },
    search: {
      query: { required: true, type: 'string', min: 1 },
      page: { required: false, type: 'number', min: 1 },
      limit: { required: false, type: 'number', min: 1, max: 100 },
    },
    changeStatus: {
      status: { required: true, type: 'string', enum: Object.values(USER_STATUS) },
    },
  },
  // Account (self) validation rules
  account: {
    updateProfile: {
      name: { required: false, type: 'string', min: 2, max: 100 },
      avatar: { required: false, type: 'string' },
      phone: { required: false, type: 'string', pattern: /^[0-9]{10}$/ },
    },
  },
};

module.exports = validationRules;
