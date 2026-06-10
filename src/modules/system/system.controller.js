const ScheduledJobRunner = require('@infra/scheduler/ScheduledJobRunner');
const logger = require('@utils/logger');

const heartbeat = async (req, res) => {
  ScheduledJobRunner.trigger('Pending Tasks Processor', 'http').catch(() => {});

  logger.info({
    message: 'heartbeat.received',
    requestId: req.id || null,
  });

  res.json({
    success: true,
    message: 'Heartbeat received, background tasks triggered.',
  });
};

module.exports = {
  heartbeat,
};
