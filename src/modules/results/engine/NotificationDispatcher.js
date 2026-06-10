const { RepositoryFactory } = require('@infra/database');
const { BET_MODE, NOTIFICATION_EVENT } = require('@config/constants/domain');
const logger = require('@utils/logger');
const notificationService = require('../../notifications/notification.service');

const gameSessionRepository = RepositoryFactory.getRepository('GameSession');
const marketRepository = RepositoryFactory.getRepository('Market');

const formatFullResult = (result) => {
  if (!result) {
    return '---';
  }

  const openPana = result.openPana ?? '***';
  const openDigit = result.openDigit ?? '*';
  const closeDigit = result.closeDigit ?? '*';
  const closePana = result.closePana ?? '***';

  return `${openPana}-${openDigit}${closeDigit}-${closePana}`;
};

const deriveFinalJodi = (openDigit, closeDigit) => {
  if (openDigit === null || openDigit === undefined || closeDigit === null || closeDigit === undefined) {
    return '--';
  }
  return `${openDigit}${closeDigit}`;
};

const resolveNotificationContext = async ({ sessionId, session, market }) => {
  if (session && market) {
    return { session, market };
  }

  const resolvedSession = session || await gameSessionRepository.findLeanById(sessionId);
  const resolvedMarket = market || (
    resolvedSession?.marketId
      ? await marketRepository.findLeanById(resolvedSession.marketId, 'code name')
      : null
  );
  return { session: resolvedSession, market: resolvedMarket };
};

const dispatchResultDeclared = async ({
  sessionId,
  session,
  market,
  declarationMode = null,
}) => {
  const resolved = await resolveNotificationContext({ sessionId, session, market });
  const resolvedSession = resolved.session;
  const resolvedMarket = resolved.market;

  if (!resolvedSession || !resolvedMarket?.code) {
    logger.warn({
      message: 'Skipping result notification. Market info unavailable.',
      sessionId,
    });

    return { skipped: true, successCount: 0, failureCount: 0, responses: [] };
  }

  const marketCode = resolvedMarket.code;
  const marketName = resolvedMarket.name || marketCode;

  const resultString = formatFullResult(resolvedSession.result);

  const finalJodi = deriveFinalJodi(
    resolvedSession.result?.openDigit,
    resolvedSession.result?.closeDigit,
  );

  const sessionDate = resolvedSession.sessionDate
    ? new Date(resolvedSession.sessionDate).toISOString().split('T')[0]
    : '';

  const payload = {
    title: `${marketName}`,
    body: resultString,
    data: {
      event: NOTIFICATION_EVENT.RESULT_DECLARED,
      sessionId: String(resolvedSession._id),
      marketCode,
      marketName,
      sessionDate,
      phase: declarationMode || (
        resolvedSession.result?.closeDigit !== null && resolvedSession.result?.closeDigit !== undefined
          ? BET_MODE.CLOSE
          : BET_MODE.OPEN
      ),
      sessionPhase: resolvedSession.phase || '',
      result: resultString,
      openPana: resolvedSession.result?.openPana || '',
      openDigit: resolvedSession.result?.openDigit ?? '',
      closePana: resolvedSession.result?.closePana || '',
      closeDigit: resolvedSession.result?.closeDigit ?? '',
      finalJodi,
    },
  };

  return notificationService.sendToMarketSubscribers(marketCode, payload);
};

module.exports = {
  dispatchResultDeclared,
};

