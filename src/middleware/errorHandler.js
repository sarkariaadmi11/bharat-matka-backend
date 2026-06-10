const config = require('@config');
const logger = require('@utils/logger');
const logService = require('../modules/admin/logs/logs.service');
const {
  AppError,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  InternalServerError,
} = require('@utils/errors');

const normalizeError = (err) => {
  if (err instanceof AppError) {
    return err;
  }

  if (err?.isJoi && Array.isArray(err?.details)) {
    return new ValidationError(
      'Validation failed',
      err.details.map((detail) => detail.message),
    );
  }

  // Mongoose validation errors
  if (err?.name === 'ValidationError' && err?.errors) {
    const details = Object.values(err.errors).map((e) => e.message);
    return new ValidationError('Validation failed', details);
  }

  // Duplicate key
  if (err?.code === 11000 && err?.keyValue) {
    const field = Object.keys(err.keyValue)[0];
    return new ValidationError(`${field} already exists`);
  }

  if (err?.name === 'CastError') {
    return new ValidationError('Invalid identifier');
  }

  // JWT errors
  if (err?.name === 'JsonWebTokenError') {
    return new UnauthorizedError('Invalid token');
  }
  if (err?.name === 'TokenExpiredError') {
    return new UnauthorizedError('Token expired');
  }

  // http-errors or custom statusCode
  if (err?.statusCode || err?.status) {
    return new AppError(err.message || 'Request failed', {
      statusCode: err.statusCode || err.status,
      code: 'REQUEST_ERROR',
    });
  }

  if (typeof err?.message === 'string' && /not found/i.test(err.message)) {
    return new NotFoundError(err.message);
  }

  return new InternalServerError('Internal server error');
};

const REDACTED_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'privateKey',
]);

const truncateValue = (value, maxLength = 2000) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.length > maxLength
    ? `${value.slice(0, maxLength)}...[truncated ${value.length - maxLength} chars]`
    : value;
};

const sanitizeValue = (value, key = '') => {
  if (value === null || value === undefined) {
    return value;
  }

  if (REDACTED_KEYS.has(String(key).toLowerCase())) {
    return '[REDACTED]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [nestedKey, nestedValue]) => {
      acc[nestedKey] = sanitizeValue(nestedValue, nestedKey);
      return acc;
    }, {});
  }

  return truncateValue(value);
};

const serializeCause = (cause) => {
  if (!cause) {
    return null;
  }

  if (cause instanceof Error) {
    return {
      name: cause.name || 'Error',
      message: cause.message || 'Unknown cause',
      stack: cause.stack,
      code: cause.code,
    };
  }

  return sanitizeValue(cause);
};

const toLogError = (err) => {
  if (!err) {
    return null;
  }

  return {
    name: err.name || 'Error',
    message: err.message || 'Unknown error',
    stack: err.stack,
    code: err.code,
    details: err.details,
    cause: serializeCause(err.cause),
  };
};

const buildRequestContext = (req) => ({
  id: req.id || null,
  route: req.originalUrl,
  method: req.method,
  ip: req.ip,
  userId: req.user?.id || null,
  params: sanitizeValue(req.params || {}),
  query: sanitizeValue(req.query || {}),
  body: sanitizeValue(req.body || {}),
  headers: sanitizeValue({
    'user-agent': req.headers['user-agent'],
    origin: req.headers.origin,
    referer: req.headers.referer,
    'content-type': req.headers['content-type'],
    accept: req.headers.accept,
    authorization: req.headers.authorization,
  }),
});

const buildErrorFingerprint = ({ err, req, normalized }) => [
  err?.name || normalized.code || 'Error',
  req?.method || 'UNKNOWN',
  req?.route?.path || req?.originalUrl || 'unknown-route',
  normalized.statusCode || 500,
].join(':');

const isAnalyticsRoute = (req) => {
  const path = req.originalUrl || '';
  return path.includes('/admin/analytics/')
    || path.includes('/admin/reports/')
    || path.includes('/admin/payments/deposits/history');
};

const errorHandler = (err, req, res, _next) => {
  const normalized = normalizeError(err);
  const requestId = req.id || res.getHeader('X-Request-Id') || null;
  const durationMs = typeof req.startTime === 'number' ? Date.now() - req.startTime : undefined;
  const requestContext = buildRequestContext(req);
  const originalError = toLogError(err);
  const normalizedError = toLogError(normalized);
  const fingerprint = buildErrorFingerprint({ err, req, normalized });
  const baseLogPayload = {
    event: 'http.request.failed',
    category: normalized.statusCode >= 500 ? 'application' : 'validation',
    requestId,
    route: req.originalUrl,
    method: req.method,
    ip: req.ip,
    statusCode: normalized.statusCode,
    durationMs,
    fingerprint,
    error: originalError,
    meta: {
      code: normalized.code,
      details: normalized.details,
      request: requestContext,
      normalizedError,
    },
  };

  if (!(err instanceof AppError)) {
    logger.error({
      message: 'Unhandled error',
      ...baseLogPayload,
    });
  } else if (normalized.statusCode >= 500) {
    logger.error({
      message: normalized.message,
      ...baseLogPayload,
    });
  } else {
    logger.warn({
      message: normalized.message,
      ...baseLogPayload,
    });
  }

  if (normalized.statusCode >= 500) {
    void logService.writeErrorLog({
      level: 'error',
      message: normalized.message,
      event: 'http.request.failed',
      category: 'application',
      requestId,
      userId: req.user?.id || null,
      route: req.originalUrl,
      method: req.method,
      ip: req.ip,
      statusCode: normalized.statusCode,
      durationMs,
      fingerprint,
      request: requestContext,
      error: {
        original: originalError,
        normalized: normalizedError,
      },
      tags: [
        'http',
        'error',
        req.method?.toLowerCase(),
        normalized.code?.toLowerCase?.(),
      ].filter(Boolean),
      meta: {
        code: normalized.code,
        details: normalized.details,
        routePath: req.route?.path || null,
        isOperational: Boolean(err?.isOperational),
        runtime: {
          env: config.NODE_ENV,
          service: 'betting-backend',
        },
      },
    });
  }

  if (isAnalyticsRoute(req)) {
    return res.status(normalized.statusCode).json({
      success: false,
      statusCode: normalized.statusCode,
      message: normalized.message,
      error: {
        code: normalized.code,
        ...(normalized.details ? { details: normalized.details } : {}),
      },
      meta: {
        traceId: requestId,
        module: 'admin-analytics',
      },
      timestamp: new Date().toISOString(),
    });
  }

  const response = {
    success: false,
    message: normalized.message,
    code: normalized.code,
    requestId,
  };

  if (normalized.details) {
    response.details = normalized.details;
  }

  return res.status(normalized.statusCode).json(response);
};

module.exports = errorHandler;
