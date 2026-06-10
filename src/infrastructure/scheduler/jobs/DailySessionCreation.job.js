const { DateTime } = require('luxon');
const { createDailySessionsForAllMarkets, areAllSessionsResultsDeclared, getDeclarationConfig } = require('@modules/sessions/sessions.service');
const { BUSINESS_TIMEZONE } = require('@utils/timezoneHelper');
const logger = require('@utils/logger');

const deferSessionCreation = async () => {
  const { graceHours } = await getDeclarationConfig();
  const now = DateTime.now().setZone(BUSINESS_TIMEZONE);
  const target = now.startOf('day').plus({ hours: graceHours, minutes: 1 });
  const delayMs = target.diff(now).toMillis();

  if (delayMs > 0) {
    logger.info({
      message: 'scheduler.daily_session_deferred',
      reason: 'pending_results',
      delayMs,
      deferHour: graceHours,
    });
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return createDailySessionsForAllMarkets();
};

module.exports = {
  name: 'Daily Market Session Creator',
  description: 'Creates game sessions at 12:01 AM IST if all results declared, otherwise defers to graceHours:01 next day',
  async run() {
    const allDeclared = await areAllSessionsResultsDeclared();
    if (allDeclared) {
      return createDailySessionsForAllMarkets();
    }
    return deferSessionCreation();
  },
};
