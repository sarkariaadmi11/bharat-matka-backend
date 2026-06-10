const asyncHandler = require('@utils/asyncHandler');
const { sendPaginated } = require('@utils/response');
const logService = require('@modules/admin/logs/logs.service');
const fs = require('fs');
const logger = require('@utils/logger');

const normalizeLevel = (value) => {
  const normalized = Number(value);
  if (Number.isFinite(normalized)) {
    if (normalized >= 60) {
      return 'fatal';
    }
    if (normalized >= 50) {
      return 'error';
    }
    if (normalized >= 40) {
      return 'warn';
    }
    if (normalized >= 30) {
      return 'info';
    }
    return 'debug';
  }

  return value ? String(value).toLowerCase() : 'info';
};

const toReadableLogEntry = (entry) => ({
  level: normalizeLevel(entry.level),
  message: entry.msg || entry.message || '',
  event: entry.event || null,
  category: entry.category || null,
  requestId: entry.requestId || null,
  userId: entry.userId || null,
  route: entry.route || null,
  method: entry.method || null,
  statusCode: entry.statusCode || null,
  durationMs: entry.durationMs || null,
  ip: entry.ip || null,
  fingerprint: entry.fingerprint || null,
  createdAt: entry.time || entry.timestamp || new Date().toISOString(),
  request: entry.request || null,
  meta: entry.meta || null,
  error: entry.error || null,
});

const parseFileLogs = ({ level, userId, requestId, route, method, statusCode, from, to }) => {
  const filePath = logger.LOG_FILE_PATH;
  if (!filePath || !fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);

  return lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((entry) => {
      if (level && normalizeLevel(entry.level) !== String(level).toLowerCase()) {
        return false;
      }
      if (userId && String(entry.userId) !== String(userId)) {
        return false;
      }
      if (requestId && String(entry.requestId) !== String(requestId)) {
        return false;
      }
      if (route && String(entry.route) !== String(route)) {
        return false;
      }
      if (method && String(entry.method || '').toUpperCase() !== String(method).toUpperCase()) {
        return false;
      }
      if (statusCode && Number(entry.statusCode) !== Number(statusCode)) {
        return false;
      }
      if (from && new Date(entry.time || entry.timestamp) < new Date(from)) {
        return false;
      }
      if (to && new Date(entry.time || entry.timestamp) > new Date(to)) {
        return false;
      }
      return true;
    })
    .map(toReadableLogEntry);
};

const getLogs = asyncHandler(async (req, res) => {
  const {
    level,
    userId,
    requestId,
    route,
    method,
    statusCode,
    from,
    to,
    page = 1,
    limit = 50,
  } = req.query;

  const filter = {};
  if (level) {
    filter.level = level;
  }
  if (userId) {
    filter.userId = userId;
  }
  if (requestId) {
    filter.requestId = requestId;
  }
  if (route) {
    filter.route = route;
  }
  if (method) {
    filter.method = method.toUpperCase();
  }
  if (statusCode) {
    filter.statusCode = Number(statusCode);
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) {
      filter.createdAt.$gte = new Date(from);
    }
    if (to) {
      filter.createdAt.$lte = new Date(to);
    }
  }

  const pageNum = Number(page) || 1;
  const limitNum = Math.min(Number(limit) || 50, 200);

  const { documents, pagination } = await logService.getLogs(
    filter,
    pageNum,
    limitNum,
    { createdAt: -1 },
  );

  if (documents.length === 0) {
    const fileLogs = parseFileLogs({
      level,
      userId,
      requestId,
      route,
      method,
      statusCode,
      from,
      to,
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = fileLogs.length;
    const start = (pageNum - 1) * limitNum;
    const paged = fileLogs.slice(start, start + limitNum);

    return sendPaginated(
      res,
      paged,
      {
        page: pageNum,
        limit: limitNum,
        total,
        pages: total === 0 ? 0 : Math.ceil(total / limitNum),
      },
      'Logs retrieved',
    );
  }

  return sendPaginated(res, documents, pagination, 'Logs retrieved');
});

module.exports = {
  getLogs,
};

