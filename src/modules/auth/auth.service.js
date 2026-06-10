/**
 * Auth Service
 * Business logic for authentication
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { RepositoryFactory } = require('@infra/database');
const ROLES = require('@config/constants/roles');
const { USER_STATUS } = require('@config/constants/domain');
const { generateTokens, hashToken, toPaise } = require('@utils');
const {
  AppError,
  ConflictError,
  NotFoundError,
} = require('@utils/errors');

const authRepository = RepositoryFactory.getRepository('Auth');
const userRepository = RepositoryFactory.getRepository('User');
const walletRepository = RepositoryFactory.getRepository('Wallet');
const roleRepository = RepositoryFactory.getRepository('Role');
const userRoleRepository = RepositoryFactory.getRepository('UserRole');
const globalConfigRepository = RepositoryFactory.getRepository('GlobalConfig');
const transactionRepository = RepositoryFactory.getRepository('Transaction');

const buildTokenPayload = async (userId, session = null) => {
  const roleContext = await userRoleRepository.getRoleContextByUserId(userId, session);
  const roles = Array.isArray(roleContext.roleCodes)
    ? [...new Set(roleContext.roleCodes.filter(Boolean).map((role) => String(role).toUpperCase()))]
    : [];
  const primaryRole = String(roleContext.primaryRole?.code || roles[0] || '').toUpperCase() || null;

  return {
    role: primaryRole,
    roles,
  };
};

const register = async (userData) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { username, phone, password } = userData;

    if (await authRepository.findOne({ phone }, session)) {
      throw new ConflictError('Phone already registered');
    }

    if (await authRepository.findOne({ username }, session)) {
      throw new ConflictError('Username already taken');
    }

    const userRole = await roleRepository.findByCode(ROLES.USER, session);
    if (!userRole) {
      throw new AppError('Default USER role not found', 500);
    }

    const user = await authRepository.create({
      username,
      phone,
      password,
      status: USER_STATUS.ACTIVE,
    }, session);

    await userRoleRepository.assignRole({
      userId: user._id,
      roleId: userRole._id,
      isPrimary: true,
      assignedBy: null,
    }, session);

    await walletRepository.create({
      userId: user._id,
      balance: 0,
      exposure: 0,
      bonus: 0,
    }, session);

    const config = await globalConfigRepository.findOne();
    const welcomeBonus = config?.welcomeBonus !== undefined && config?.welcomeBonus !== null ? Number(config.welcomeBonus) : 5;
    if (welcomeBonus > 0) {
      const welcomeBonusPaise = toPaise(welcomeBonus);
      await walletRepository.creditBalance(user._id, welcomeBonusPaise, 'bonus', session);
      await transactionRepository.recordDeposit(
        {
          userId: user._id,
          amount: welcomeBonusPaise,
          balanceAfter: welcomeBonusPaise,
          referenceId: `WELCOME_BONUS_${user._id}`,
          meta: { source: 'welcome_bonus', bonusAmount: welcomeBonus },
        },
        session,
      );
    }

    await session.commitTransaction();

    const tokenPayload = await buildTokenPayload(user._id);
    const tokens = generateTokens({
      _id: user._id,
      role: tokenPayload.role,
      roles: tokenPayload.roles,
    });

    await authRepository.updateRefreshToken(
      user._id,
      hashToken(tokens.refreshToken),
    );

    return {
      user: {
        id: user._id,
        username: user.username,
        phone: user.phone,
        status: user.status,
        role: tokenPayload.role,
      },
      ...tokens,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const login = async (phone, password) => {
  const user = await authRepository.findOneWithPassword({ phone });

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid phone or password', 401);
  }

  const exclusion = await userRepository.checkSelfExclusion(user._id);
  if (exclusion.excluded) {
    throw new AppError(`Account self-excluded until ${exclusion.until}`, 403);
  }

  if (user.status === USER_STATUS.INACTIVE) {
    throw new AppError('Account is not active', 403);
  }

  if (user.status === USER_STATUS.BANNED) {
    throw new AppError('User account is banned', 403);
  }

  await authRepository.updateLastLogin(user._id);

  const tokenPayload = await buildTokenPayload(user._id);
  const tokens = generateTokens({
    _id: user._id,
    role: tokenPayload.role,
    roles: tokenPayload.roles,
  });

  await authRepository.updateRefreshToken(
    user._id,
    hashToken(tokens.refreshToken),
  );

  return {
    user: {
      id: user._id,
      username: user.username,
      phone: user.phone,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      role: tokenPayload.role,
    },
    ...tokens,
  };
};

const refreshTokens = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) {
    throw new AppError('Refresh token required', 400);
  }

  let decoded;
  try {
    decoded = jwt.verify(
      incomingRefreshToken,
      process.env.JWT_REFRESH_SECRET,
    );
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await authRepository.findByIdWithRefreshToken(decoded.sub);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const incomingHash = hashToken(incomingRefreshToken);
  if (incomingHash !== user.refreshTokenHash) {
    throw new AppError('Invalid refresh token', 401);
  }

  const tokenPayload = await buildTokenPayload(user._id);
  const tokens = generateTokens({
    _id: user._id,
    role: tokenPayload.role,
    roles: tokenPayload.roles,
  });

  await authRepository.updateRefreshToken(
    user._id,
    hashToken(tokens.refreshToken),
  );

  return tokens;
};

const logout = async (userId) => {
  await authRepository.clearRefreshToken(userId);
  return { message: 'Logged out successfully' };
};

const forgotPassword = async (phone) => {
  const user = await authRepository.findOne({ phone });
  if (!user) {
    return { message: 'If phone exists, reset instructions will be sent' };
  }
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  await authRepository.setPasswordResetToken(user._id, hashedToken);
  return {
    message: 'Password reset token generated',
    resetToken,
    userId: user._id,
  };
};

const resetPassword = async (resetToken, newPassword) => {
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  const user = await authRepository.findByResetToken(hashedToken);
  await authRepository.updatePassword(user._id, newPassword);
  await authRepository.clearRefreshToken(user._id);
  return { message: 'Password updated successfully. Please login again.' };
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const userWithPassword = await authRepository.findOneWithPassword({ _id: userId });
  if (!userWithPassword) {
    throw new NotFoundError('User not found');
  }

  const isPasswordValid = await userWithPassword.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 401);
  }

  await authRepository.updatePassword(userWithPassword._id, newPassword);
  await authRepository.clearRefreshToken(userWithPassword._id);

  return {
    message: 'Password changed successfully. Please login again.',
  };
};

const deleteAccount = async (userId) => {
  await authRepository.findById(userId);
  await authRepository.deleteById(userId);
  return { message: 'Account deleted successfully' };
};

module.exports = {
  register,
  login,
  refreshTokens,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteAccount,
};
