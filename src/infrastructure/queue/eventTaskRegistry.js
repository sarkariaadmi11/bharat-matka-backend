/**
 * Event Task Registry Service
 * Centralized service for registering and scheduling tasks
 * Eliminates tight coupling throughout the application
 */

const { EventTask } = require('@infra/models');
const { EVENT_TASK_STATUS } = require('@config/constants/domain');
const logger = require('@utils/logger');

class EventTaskRegistry {
  // Registry of all scheduled task handlers
  static taskHandlers = {};

  /**
   * Register a task handler
   * @param {String} taskType - Task type identifier (e.g., 'MARKET_LOCK', 'SETTLE_OPEN_RESULT')
   * @param {Function} handler - Async handler function that processes the task
   * @param {String} description - Brief description of the task
   */
  static registerTaskHandler(taskType, handler, description = '') {
    if (this.taskHandlers[taskType]) {
      logger.warn({
        message: 'task.handler_overwritten',
        taskType,
      });
    }
    this.taskHandlers[taskType] = {
      handler,
      description,
    };
    logger.info({
      message: 'task.handler_registered',
      taskType,
      description,
    });
  }

  /**
   * Get registered handler for a task type
   * @param {String} taskType - Task type identifier
   * @returns {Function|null} Handler function or null if not found
   */
  static getTaskHandler(taskType) {
    const task = this.taskHandlers[taskType];
    if (!task) {
      logger.warn({
        message: 'task.handler_missing',
        taskType,
      });
      return null;
    }
    return task.handler;
  }

  /**
   * Schedule a task for execution
   * @param {Object} config - Task configuration
   * @param {String} config.type - Task type (must be registered)
   * @param {Date} config.scheduledAt - When to execute
   * @param {Object} config.payload - Data for the task handler
   * @param {Number} config.priority - Priority level (3=high, 2=med, 1=low), default 2
   * @param {Number} config.maxAttempts - Max retry attempts, default 5
   * @returns {Promise<EventTask>} Created task document
   */
  static async scheduleTask({
    type,
    scheduledAt,
    payload = {},
    priority = 2,
    maxAttempts = 5,
    session = null,
  }) {
    // Validate task type is registered
    if (!this.taskHandlers[type]) {
      throw new Error(
        `Task type '${type}' not registered. Available: ${Object.keys(this.taskHandlers).join(', ')}`,
      );
    }

    if (!scheduledAt || !(scheduledAt instanceof Date)) {
      throw new Error('scheduledAt must be a valid Date instance');
    }

    const task = new EventTask({
      type,
      status: EVENT_TASK_STATUS.PENDING,
      priority,
      scheduledAt,
      payload,
      maxAttempts,
      attempts: 0,
    });
    await task.save({ session });

    logger.info({
      message: 'task.scheduled',
      taskType: type,
      scheduledAt: scheduledAt.toISOString(),
      priority,
      maxAttempts,
      payload,
    });
    return task;
  }

  /**
   * Get all registered task types
   * @returns {Array} List of registered task types with descriptions
   */
  static getRegisteredTasks() {
    return Object.entries(this.taskHandlers).map(([type, { description }]) => ({
      type,
      description,
    }));
  }

  /**
   * Clear all registered handlers (useful for testing)
   */
  static clearAllHandlers() {
    this.taskHandlers = {};
    logger.info({
      message: 'task.handlers_cleared',
    });
  }
}

module.exports = EventTaskRegistry;
