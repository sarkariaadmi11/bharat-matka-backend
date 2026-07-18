const { createDailySessionsForAllMarkets, areAllSessionsResultsDeclared } = require('@modules/sessions/sessions.service');
const logger = require('@utils/logger');

module.exports = {
  name: 'Daily Market Session Creator',
  description: 'Creates sessions for all active markets once prior results are declared or their grace period has elapsed. Idempotent and safe to run on every tick.',
  async run() {
    const allDeclared = await areAllSessionsResultsDeclared();
    if (!allDeclared) {
      logger.info({ message: 'scheduler.daily_session_creation_deferred', reason: 'pending_results' });
      return { deferred: true };
    }
    return createDailySessionsForAllMarkets();
  },
};
