/**
 * Auth Controller
 * Handles authentication HTTP requests
 */

const authService = require('./auth.service');
const {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
} = require('./auth.validator');
const { sendSuccess } = require('@utils/response');
const asyncHandler = require('@utils/asyncHandler');

const register = asyncHandler(async (req, res) => {
  const payload = await validateRegister(req.body);
  const result = await authService.register(payload);

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  sendSuccess(res, result, 'User registered successfully', 201);
});

const login = asyncHandler(async (req, res) => {
  const { phone, password } = await validateLogin(req.body);
  const result = await authService.login(phone, password);
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  sendSuccess(res, result, 'Logged in successfully');
});

const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = await validateRefreshToken(req.body);
  const result = await authService.refreshTokens(refreshToken);
  sendSuccess(res, result, 'Token refreshed successfully');
});

const logout = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await authService.logout(userId);
  sendSuccess(res, result, 'Logged out successfully');
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { phone } = await validateForgotPassword(req.body);
  const result = await authService.forgotPassword(phone);
  sendSuccess(res, { message: result.message }, 'Password reset initiated');
});

const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword, confirmPassword } = await validateResetPassword(req.body);
  const result = await authService.resetPassword(resetToken, newPassword, confirmPassword);
  sendSuccess(res, result, 'Password updated successfully');
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = await validateChangePassword(req.body);
  const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
  sendSuccess(res, result, result.message);
});

const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await authService.deleteAccount(userId);
  sendSuccess(res, result, 'Account deleted successfully');
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  deleteAccount,
};
