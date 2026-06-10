const crypto = require('crypto');
const logger = require('@utils/logger');
const logService = require('../modules/admin/logs/logs.service');

/**
 * Request Logging Middleware (structured + persistent)
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  req.startTime = startTime;

  if (!req.id) {
    req.id = crypto.randomUUID();
  }
  res.setHeader('X-Request-Id', req.id);

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const payload = {
      message: 'request',
      event: 'http.request.completed',
      category: 'http',
      requestId: req.id,
      userId: req.user?.id || null,
      route: req.originalUrl,
      method: req.method,
      ip: req.ip,
      statusCode: res.statusCode,
      durationMs,
      meta: {
        userAgent: req.headers['user-agent'],
      },
    };

    logger[level](payload);

    if (level !== 'error') {
      void logService.writeLog({ ...payload, level });
    }
  });

  next();
};

module.exports = requestLogger;
