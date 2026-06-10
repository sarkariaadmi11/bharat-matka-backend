const { RepositoryFactory } = require('@infra/database');

const logRepository = RepositoryFactory.getRepository('Log');

const shouldPersistLog = (payload) => {
  if (!payload) {
    return false;
  }
  if (payload.message === 'request' || payload.event === 'http.request.completed') {
    return false;
  }
  if (payload.level === 'error') {
    return true;
  }
  const audit = payload.meta?.audit;
  if (!audit) {
    return false;
  }
  return audit.category === 'FINANCIAL' || audit.category === 'ADMIN_OP';
};

const writeLog = async (payload) => {
  if (!shouldPersistLog(payload)) {
    return false;
  }
  try {
    await logRepository.createLog(payload);
    return true;
  } catch {
    // Intentionally swallow to avoid log failures breaking requests
    return false;
  }
};

const writeErrorLog = async (payload) => {
  return writeLog({ ...payload, level: 'error' });
};

const writeAuditLog = async ({ message, requestId, userId, route, method, ip, meta }) => {
  return writeLog({
    level: 'info',
    message,
    requestId,
    userId,
    route,
    method,
    ip,
    meta: {
      ...meta,
      audit: {
        category: meta?.category || 'ADMIN_OP',
      },
    },
  });
};

const cleanupOldLogs = async (cutoffDate) => {
  try {
    await logRepository.deleteOlderThan(cutoffDate);
  } catch {
    // Intentionally swallow to avoid log cleanup failures breaking requests
  }
};

const getLogs = async (filter, page, limit, sort) => {
  return logRepository.findPaged(filter, page, limit, sort);
};

module.exports = {
  writeLog,
  writeErrorLog,
  writeAuditLog,
  cleanupOldLogs,
  getLogs,
};

