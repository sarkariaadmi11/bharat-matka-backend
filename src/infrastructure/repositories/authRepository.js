/**
 * Auth Repository
 * Handles authentication-specific database operations
 */

const BaseRepository = require('./baseRepository');
const { User } = require('@infra/models');
const {
  AppError,
  NotFoundError,
} = require('@utils/errors');

class AuthRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  /**
   * Find user with password field explicitly selected
   * Useful for login (requires { phone: '...' } or { email: '...' })
   */
  async findOneWithPassword(filter) {
    const user = await this.model.findOne(filter).select('+password');

    if (!user) {
      return null;
    }

    if (user.deletedAt) {
      return null;
    }

    return user;
  }

  /**
   * Check if a phone number already exists
   */
  async phoneExists(phone) {
    return await this.model.exists({ phone });
  }

  /**
   * Find user by ID with Refresh Token explicitly selected
   * (RefreshTokenHash is select: false by default)
   */
  async findByIdWithRefreshToken(id) {
    return await this.model.findById(id).select('+refreshTokenHash');
  }

  /**
   * Update the user's Refresh Token
   */
  async updateRefreshToken(userId, refreshTokenHash) {
    return await this.update(userId, {
      refreshTokenHash,
    });
  }

  /**
   * Update password reset token
   */
  async setPasswordResetToken(userId, tokenHash, expiresIn = 3600000) {
    const expiryDate = new Date(Date.now() + expiresIn);

    return await this.update(userId, {
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: expiryDate,
    });
  }

  /**
   * Find user by password reset token
   */
  async findByResetToken(token) {
    const user = await this.model.findOne({
      passwordResetTokenHash: token,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetTokenHash +password');

    if (!user) {
      throw new AppError('Invalid or expired reset token', 401);
    }

    return user;
  }

  async updatePassword(userId, newPassword) {
    const user = await this.model.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    user.password = newPassword;
    user.refreshTokenHash = undefined;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;

    return await user.save();
  }

  /**
   * Set email verification token
   */
  // async setEmailVerificationToken(userId, token) {
  //   return await this.update(userId, {
  //     emailVerificationToken: token,
  //   });
  // }

  /**
   * Verify email
   */
  async verifyEmail(userId) {
    return await this.update(userId, {
      emailVerified: true,
      emailVerificationToken: undefined,
    });
  }

  async markUserVerified(userId, source = 'manual') {
    return await this.update(userId, {
      isVerified: true,
      'compliance.ageVerified': true,
      'compliance.verificationSource': source,
      'compliance.verifiedAt': new Date(),
    });
  }

  /**
   * Update last login
   */
  async updateLastLogin(userId) {
    return await this.update(userId, {
      lastLoginAt: new Date(),
    });
  }

  async clearRefreshToken(userId) {
    return await this.updateRefreshToken(userId, null);
  }
}

module.exports = AuthRepository;

