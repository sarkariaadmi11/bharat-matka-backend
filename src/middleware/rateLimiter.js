const { rateLimiterService: rateLimiter } = require('../infrastructure/cache/rateLimiterService');
const rlConfig = require('@config/rateLimiterConfig');
const { RateLimitError } = require('@utils/errors');

/**
 * Helper: attach limit headers
 */
const attachHeaders = (res, meta) => {
  res.set('X-RateLimit-Limit', String(meta.limit));
  res.set('X-RateLimit-Remaining', String(meta.remaining));
  res.set('X-RateLimit-Reset', String(meta.reset));
};

const getClientIp = (req) => {
  if (req.ip) {
    return req.ip;
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
};

const sendRateLimitError = (scope) => new RateLimitError(`Too many requests (${scope})`);

/**
 * IP-level limiter (coarse)
 */
const ipLimiter = (req, res, next) => {
  const ip = getClientIp(req);
  const meta = rateLimiter.increment('ip', ip, rlConfig.ip.windowMs, rlConfig.ip.max);
  attachHeaders(res, meta);
  if (!meta.allowed) {
    return next(sendRateLimitError('IP'));
  }
  return next();
};

/**
 * User-level limiter (requires auth middleware to set req.user)
 */
const userLimiter = (req, res, next) => {
  const userId = req.user && req.user.id;
  if (!userId) {
    // fallback to IP for unauthenticated
    return ipLimiter(req, res, next);
  }
  const meta = rateLimiter.increment('user', userId, rlConfig.user.windowMs, rlConfig.user.max);
  attachHeaders(res, meta);
  if (!meta.allowed) {
    return next(sendRateLimitError('User'));
  }
  return next();
};

/**
 * Action-level limiter factory (e.g., PLACE_BET)
 */
const actionLimiter = (actionKey) => (req, res, next) => {
  const cfg = rlConfig.action[actionKey] || rlConfig.action.DEFAULT;
  // prefer authenticated user-id; else IP
  const subject = (req.user && req.user.id) || getClientIp(req);
  const meta = rateLimiter.increment('action', subject, cfg.windowMs, cfg.max, actionKey);
  attachHeaders(res, meta);
  if (!meta.allowed) {
    return next(sendRateLimitError(actionKey));
  }
  return next();
};

module.exports = {
  ipLimiter,
  userLimiter,
  actionLimiter,
};
