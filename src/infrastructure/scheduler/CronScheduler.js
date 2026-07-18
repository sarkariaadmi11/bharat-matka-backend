const cron = require('node-cron');
const ScheduledJobRunner = require('./ScheduledJobRunner');
const DailySessionCreationJob = require('./jobs/DailySessionCreation.job');
const PendingTasksProcessorJob = require('./jobs/PendingTasksProcessor.job');
const { BUSINESS_TIMEZONE } = require('@utils/timezoneHelper');
const logger = require('@utils/logger');

const SCHEDULES = [
  {
    job: DailySessionCreationJob,
    expression: '*/10 * * * *', // every 10 minutes — idempotent, resumable across restarts
  },
  {
    job: PendingTasksProcessorJob,
    expression: '*/10 * * * *', // every 10 minutes
  },
];

const start = () => {
  for (const { job, expression } of SCHEDULES) {
    ScheduledJobRunner.register(job);

    cron.schedule(
      expression,
      () => ScheduledJobRunner.trigger(job.name, 'cron'),
      { timezone: BUSINESS_TIMEZONE },
    );

    logger.info({
      message: 'scheduler.job_scheduled',
      jobName: job.name,
      expression,
    });
  }

  logger.info({ message: 'scheduler.started', jobCount: SCHEDULES.length });
};

module.exports = { start };
