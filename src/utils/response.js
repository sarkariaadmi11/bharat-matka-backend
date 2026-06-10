const { BUSINESS_TIMEZONE } = require('./timezoneHelper');

/**
 * Centralized Response Handler
 * All API responses should use this utility
 */

const buildSuccessEnvelope = ({
  statusCode = 200,
  message = 'Success',
  data = null,
  pagination = null,
  meta = null,
}) => ({
  success: true,
  statusCode,
  message,
  data,
  pagination,
  ...(meta ? { meta } : {}),
  timestamp: new Date().toISOString(),
});

const buildAnalyticsMeta = (req, meta = {}) => ({
  generatedAt: new Date().toISOString(),
  timezone: BUSINESS_TIMEZONE,
  traceId: req?.id || req?.headers?.['x-request-id'] || null,
  ...meta,
});

const sendEnvelope = (res, payload) => res.status(payload.statusCode).json(payload);

const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  return sendEnvelope(res, buildSuccessEnvelope({ statusCode, message, data }));
};

const sendError = (res, error, message = 'Error', statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    error: error instanceof Error ? error.message : error,
    timestamp: new Date().toISOString(),
  });
};

const sendPaginated = (res, data, pagination, message = 'Success', statusCode = 200) => {
  return sendEnvelope(res, buildSuccessEnvelope({
    statusCode,
    message,
    data,
    pagination,
  }));
};

const sendDataWithMeta = (res, data, meta, statusCode = 200) =>
  res.status(statusCode).json({
    data,
    meta,
  });

const sendAnalyticsSuccess = (req, res, {
  data,
  message,
  pagination = null,
  meta = {},
  statusCode = 200,
}) => sendEnvelope(res, buildSuccessEnvelope({
  statusCode,
  message,
  data,
  pagination,
  meta: buildAnalyticsMeta(req, meta),
}));

module.exports = {
  buildSuccessEnvelope,
  buildAnalyticsMeta,
  sendSuccess,
  sendError,
  sendPaginated,
  sendDataWithMeta,
  sendAnalyticsSuccess,
};
