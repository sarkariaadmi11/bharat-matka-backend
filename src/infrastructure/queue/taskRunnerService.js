const EventTask = require('@infra/models/EventTask');
const ErrorTask = require('@infra/models/ErrorTask');
const EventTaskRegistry = require('./eventTaskRegistry');
const { EVENT_TASK_STATUS } = require('@config/constants/domain');
const logger = require('@utils/logger');

const TaskRunner = {
  async run() {
    const tasks = await EventTask.find({
      status: { $in: [EVENT_TASK_STATUS.PENDING] },
      scheduledAt: { $lte: new Date() },
    })
      .sort({ priority: -1, scheduledAt: 1 })
      .limit(25);

    for (const task of tasks) {
      try {
        task.status = EVENT_TASK_STATUS.PROCESSING;
        await task.save();

        logger.info({
          message: 'task.started',
          taskId: String(task._id),
          taskType: task.type,
          attempts: task.attempts,
          payload: task.payload,
        });

        // Get the registered handler for this task type
        const handler = EventTaskRegistry.getTaskHandler(task.type);
        if (!handler) {
          throw new Error(`No handler registered for task type: ${task.type}`);
        }

        // Execute the handler with task payload
        await handler(task.payload);

        task.status = EVENT_TASK_STATUS.COMPLETED;
        task.processedAt = new Date();

        logger.info({
          message: 'task.completed',
          taskId: String(task._id),
          taskType: task.type,
          processedAt: task.processedAt.toISOString(),
        });
      } catch (err) {
        task.attempts += 1;
        task.status = task.attempts >= task.maxAttempts
          ? EVENT_TASK_STATUS.FAILED
          : EVENT_TASK_STATUS.PENDING;

        // Log error to separate table
        await ErrorTask.create({
          taskId: task._id,
          taskType: task.type,
          errorMessage: err.message,
          stackTrace: err.stack,
          attemptNumber: task.attempts,
        });

        logger.error({
          message: 'task.failed',
          taskId: String(task._id),
          taskType: task.type,
          attempts: task.attempts,
          maxAttempts: task.maxAttempts,
          error: {
            name: err?.name || 'Error',
            message: err?.message || 'Task execution failed',
            stack: err?.stack,
          },
        });
      }
      await task.save();
    }
  },
};

module.exports = TaskRunner;

