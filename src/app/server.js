require('module-alias/register');
require('module-alias').addAliases({
  '@app': `${__dirname}`,
  '@config': `${process.cwd()}/src/config`,
  '@domain': `${process.cwd()}/src/domain`,
  '@infra': `${process.cwd()}/src/infrastructure`,
  '@modules': `${process.cwd()}/src/modules`,
  '@middleware': `${process.cwd()}/src/middleware`,
  '@utils': `${process.cwd()}/src/utils`,
});

const app = require('./app');
const config = require('@config');
const { connectDB } = require('@infra/database');
const { initializeTaskHandlers } = require('../infrastructure/queue/taskHandlersInit');
const { startLogCleanupJob } = require('../modules/admin/logs/logCleanup.service');
const CronScheduler = require('../infrastructure/scheduler/CronScheduler');
const logger = require('@utils/logger');

let server;

const startServer = async () => {
  await connectDB();

  initializeTaskHandlers();
  startLogCleanupJob();
  CronScheduler.start();

  server = app.listen(config.PORT, () => {
    logger.info({
      message: 'server.started',
      port: config.PORT,
      env: config.NODE_ENV,
      apiVersion: config.API_VERSION,
    });
  });
};

const exitWithStartupError = (error) => {
  logger.fatal({
    message: 'server.startup_failed',
    error: {
      name: error?.name || 'Error',
      message: error?.message || 'Server startup failed',
      stack: error?.stack,
    },
  });
  process.exit(1);
};

process.on('SIGTERM', () => {
  logger.info({
    message: 'server.shutdown_requested',
    signal: 'SIGTERM',
  });
  if (!server) {
    process.exit(0);
  }
  server.close(() => {
    logger.info({
      message: 'server.stopped',
      signal: 'SIGTERM',
    });
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info({
    message: 'server.shutdown_requested',
    signal: 'SIGINT',
  });
  if (!server) {
    process.exit(0);
  }
  server.close(() => {
    logger.info({
      message: 'server.stopped',
      signal: 'SIGINT',
    });
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logger.fatal({
    message: 'server.uncaught_exception',
    error: {
      name: error?.name || 'Error',
      message: error?.message || 'Uncaught exception',
      stack: error?.stack,
    },
  });
  process.exit(1);
});

startServer().catch(exitWithStartupError);

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({
    message: 'server.unhandled_rejection',
    promise: promise ? String(promise) : null,
    error: {
      name: reason?.name || 'UnhandledRejection',
      message: reason?.message || String(reason),
      stack: reason?.stack,
    },
  });
  process.exit(1);
});
