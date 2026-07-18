const logger = require('@utils/logger');

class ScheduledJobRunner {
  static jobRegistry = {};
  static activeJobs = new Set();

  static register(job) {
    if (!job?.name || typeof job.run !== 'function') {
      throw new Error('Job must have a name and a run() function');
    }
    if (this.jobRegistry[job.name]) {
      logger.warn({ message: 'scheduler.job_overwritten', jobName: job.name });
    }
    this.jobRegistry[job.name] = job;
  }

  /**
   * Trigger a job by name. Safe to call fire-and-forget.
   * Errors are logged but never re-thrown.
   *
   * @param {string} jobName
   * @param {'cron'|'http'|'manual'} triggeredBy
   */
  static async trigger(jobName, triggeredBy = 'cron') {
    const job = this.jobRegistry[jobName];
    if (!job) {
      logger.warn({ message: 'scheduler.job_not_found', jobName });
      return;
    }

    if (this.activeJobs.has(jobName)) {
      logger.warn({ message: 'scheduler.job_skipped_already_active', jobName, triggeredBy });
      return;
    }

    this.activeJobs.add(jobName);
    try {
      await job.run();
    } catch (err) {
      logger.error({
        message: 'scheduler.job_failed',
        jobName,
        triggeredBy,
        error: {
          name: err?.name || 'Error',
          message: err?.message,
          stack: err?.stack,
        },
      });
    } finally {
      this.activeJobs.delete(jobName);
    }
  }

  static getRegisteredJobs() {
    return Object.values(this.jobRegistry).map(({ name, description }) => ({
      name,
      description: description || '',
    }));
  }
}

module.exports = ScheduledJobRunner;
