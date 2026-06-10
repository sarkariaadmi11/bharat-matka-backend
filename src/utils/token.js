const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
} = require('@config');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateTokens = (user) => {
  const declaredRoles = Array.isArray(user.roles)
    ? [...new Set(user.roles.filter(Boolean).map((role) => String(role).toUpperCase()))]
    : [];
  const primaryRole = String(user.role?.code || user.role || declaredRoles[0] || '').toUpperCase();
  const roles = declaredRoles.length > 0
    ? declaredRoles
    : (primaryRole ? [primaryRole] : []);

  const payload = {
    sub: user._id.toString(),
    roles,
  };
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN || '15m',
  });

  const refreshToken = jwt.sign(
    { sub: user._id.toString() },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN || '7d' },
  );

  return { accessToken, refreshToken };
};

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

module.exports = { generateTokens, hashToken };
