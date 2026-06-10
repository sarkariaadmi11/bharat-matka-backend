describe('CronScheduler', () => {
  let mockCronSchedule;
  let mockRunner;

  beforeEach(() => {
    jest.resetModules();

    mockCronSchedule = jest.fn();
    mockRunner = {
      register: jest.fn(),
      trigger: jest.fn().mockResolvedValue(undefined),
      getRegisteredJobs: jest.fn().mockReturnValue([]),
    };

    jest.doMock('node-cron', () => ({ schedule: mockCronSchedule }));
    jest.doMock('../../../../src/infrastructure/scheduler/ScheduledJobRunner', () => mockRunner);
    jest.doMock('@utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
    jest.doMock('@utils/timezoneHelper', () => ({ BUSINESS_TIMEZONE: 'Asia/Kolkata' }));
    jest.doMock('@modules/sessions/sessions.service', () => ({
      createDailySessionsForAllMarkets: jest.fn(),
    }));
    jest.doMock('@infra/queue/taskRunnerService', () => ({ run: jest.fn() }));
  });

  const load = () => require('../../../../src/infrastructure/scheduler/CronScheduler');

  test('registers both jobs when start() is called', () => {
    load().start();
    expect(mockRunner.register).toHaveBeenCalledTimes(2);
  });

  test('schedules daily session creation at 12:01 AM', () => {
    load().start();

    const [expression] = mockCronSchedule.mock.calls.find(([expr]) => expr === '1 0 * * *') || [];
    expect(expression).toBe('1 0 * * *');
  });

  test('schedules pending task processing every 10 minutes', () => {
    load().start();

    const [expression] = mockCronSchedule.mock.calls.find(([expr]) => expr === '*/10 * * * *') || [];
    expect(expression).toBe('*/10 * * * *');
  });

  test('all cron jobs use IST timezone', () => {
    load().start();

    for (const call of mockCronSchedule.mock.calls) {
      const options = call[2];
      expect(options?.timezone).toBe('Asia/Kolkata');
    }
  });

  test('cron callback triggers the correct job via ScheduledJobRunner', async () => {
    load().start();

    // Simulate node-cron firing the daily session callback
    const dailyCronCallback = mockCronSchedule.mock.calls.find(
      ([expr]) => expr === '1 0 * * *',
    )[1];

    await dailyCronCallback();

    expect(mockRunner.trigger).toHaveBeenCalledWith('Daily Market Session Creator', 'cron');
  });

  test('cron callback triggers pending tasks processor', async () => {
    load().start();

    const heartbeatCronCallback = mockCronSchedule.mock.calls.find(
      ([expr]) => expr === '*/10 * * * *',
    )[1];

    await heartbeatCronCallback();

    expect(mockRunner.trigger).toHaveBeenCalledWith('Pending Tasks Processor', 'cron');
  });
});
