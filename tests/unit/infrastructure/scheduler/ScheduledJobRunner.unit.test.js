describe('ScheduledJobRunner', () => {
  let runner;
  let mockLogger;

  beforeEach(() => {
    jest.resetModules();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    jest.doMock('@utils/logger', () => mockLogger);

    runner = require('../../../../src/infrastructure/scheduler/ScheduledJobRunner');
  });

  const makeJob = (name, runFn) => ({
    name,
    description: `Test job: ${name}`,
    run: runFn || jest.fn().mockResolvedValue({ ok: true }),
  });

  describe('register()', () => {
    test('registers a valid job without throwing', () => {
      expect(() => runner.register(makeJob('Test Job'))).not.toThrow();
    });

    test('throws when job has no name', () => {
      expect(() => runner.register({ run: jest.fn() })).toThrow();
    });

    test('throws when job has no run function', () => {
      expect(() => runner.register({ name: 'No Run' })).toThrow();
    });
  });

  describe('trigger()', () => {
    test('calls run() on the registered job', async () => {
      const run = jest.fn().mockResolvedValue(undefined);
      runner.register(makeJob('Alpha', run));

      await runner.trigger('Alpha');

      expect(run).toHaveBeenCalledTimes(1);
    });

    test('logs a warning and does not throw for an unregistered job', async () => {
      await expect(runner.trigger('Ghost Job')).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'scheduler.job_not_found', jobName: 'Ghost Job' }),
      );
    });

    test('catches errors from run() and logs them without re-throwing', async () => {
      const boom = new Error('database exploded');
      runner.register(makeJob('Crasher', jest.fn().mockRejectedValue(boom)));

      await expect(runner.trigger('Crasher')).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'scheduler.job_failed',
          jobName: 'Crasher',
          error: expect.objectContaining({ message: 'database exploded' }),
        }),
      );
    });

    test('includes triggeredBy in the error log', async () => {
      runner.register(makeJob('Failer', jest.fn().mockRejectedValue(new Error('oops'))));

      await runner.trigger('Failer', 'http');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ triggeredBy: 'http' }),
      );
    });

    test('does not call run() if the same job is already running', async () => {
      let resolveRun;
      const run = jest.fn().mockReturnValue(new Promise((res) => {
        resolveRun = res;
      }));
      runner.register(makeJob('Slow Job', run));

      // First trigger — hangs until resolveRun is called
      const first = runner.trigger('Slow Job');

      // Second trigger while first is still in-flight
      await runner.trigger('Slow Job');

      expect(run).toHaveBeenCalledTimes(1);

      resolveRun();
      await first;
    });

    test('logs a warning when a trigger is skipped because the job is already active', async () => {
      let resolveRun;
      const run = jest.fn().mockReturnValue(new Promise((res) => {
        resolveRun = res;
      }));
      runner.register(makeJob('Slow Job', run));

      const first = runner.trigger('Slow Job');
      await runner.trigger('Slow Job', 'http');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'scheduler.job_skipped_already_active',
          jobName: 'Slow Job',
          triggeredBy: 'http',
        }),
      );

      resolveRun();
      await first;
    });

    test('allows the job to run again after the previous run finishes', async () => {
      const run = jest.fn().mockResolvedValue(undefined);
      runner.register(makeJob('Sequential Job', run));

      await runner.trigger('Sequential Job');
      await runner.trigger('Sequential Job');

      expect(run).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRegisteredJobs()', () => {
    test('returns all registered job names and descriptions', () => {
      runner.register(makeJob('Job One'));
      runner.register(makeJob('Job Two'));

      const jobs = runner.getRegisteredJobs();

      expect(jobs.map((j) => j.name)).toEqual(expect.arrayContaining(['Job One', 'Job Two']));
    });
  });
});
