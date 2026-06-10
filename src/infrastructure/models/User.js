const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { USER_STATUS } = require('@config/constants/domain');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      sparse: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    status: {
      type: String,
      required: true,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
      index: true, // active/banned queries are common
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
    compliance: {
      dob: {
        type: Date,
        index: false, // do NOT index unless legally required
      },

      ageVerified: {
        type: Boolean,
        default: false,
      },

      verificationSource: {
        type: String, // manual / kyc / document / third-party
      },

      verifiedAt: {
        type: Date,
      },
      selfExclusion: {
        enabled: {
          type: Boolean,
          default: false,
        },

        from: {
          type: Date,
        },

        to: {
          type: Date,
        },

        reason: {
          type: String,
        },
      },
    },

    refreshTokenHash: {
      type: String,
      select: false,
    },

    passwordResetTokenHash: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    role: {
      // Temporary mirror for direct lookups; UserRole remains the source of truth.
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      index: true,
    },

    deletedAt: {
      type: Date,
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}, // roles, tags, flags go here (NOT schema)
    },

    lastLoginAt: Date,
  },
  { timestamps: true },
);

// Password Hash
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
