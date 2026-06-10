const TaskRunner = require('@infra/queue/taskRunnerService');

module.exports = {
  name: 'Pending Tasks Processor',
  description: 'Picks up and executes all due pending event tasks (market locks, phase changes, settlements)',
  async run() {
    await TaskRunner.run();
  },
};
