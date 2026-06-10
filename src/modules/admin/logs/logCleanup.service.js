const config = require('@config');
const logService = require('@modules/admin/logs/logs.service');
const logger = require('@utils/logger');

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_CLEANUP_INTERVAL_HOURS = 24;

const startLogCleanupJob = () => {
  const retentionDays = Number(config.LOG_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
  const intervalHours = Number(config.LOG_CLEANUP_INTERVAL_HOURS) || DEFAULT_CLEANUP_INTERVAL_HOURS;
  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;

  const runCleanup = async () => {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    await logService.cleanupOldLogs(cutoff);
  };

  runCleanup().catch((err) => {
    logger.warn({ message: 'Log cleanup failed', error: err?.message });
  });

  const timer = setInterval(() => {
    runCleanup().catch((err) => {
      logger.warn({ message: 'Log cleanup failed', error: err?.message });
    });
  }, intervalMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }
};

module.exports = {
  startLogCleanupJob,
};

