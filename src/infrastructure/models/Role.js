const mongoose = require('mongoose');
const { MARKET_STATUS } = require('@config/constants/domain');

const roleSchema = new mongoose.Schema(
  {
    code: {
      type: String, // e.g. ADMIN, USER, AGENT
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
    },

    isSystem: {
      type: Boolean,
      default: false,
    },

    permissions: {
      // Temporary mirror for read convenience; RolePermission remains authoritative.
      type: [String],
      default: [],
    },

    status: {
      type: String,
      default: MARKET_STATUS.ACTIVE,
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Role', roleSchema);
