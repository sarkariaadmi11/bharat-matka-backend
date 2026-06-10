const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema(
  {
    code: {
      type: String, // BET_PLACE, RESULT_DECLARE
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },

    description: String,
  },
  { timestamps: true },
);

module.exports = mongoose.model('Permission', permissionSchema);
