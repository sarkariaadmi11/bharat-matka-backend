const { RepositoryFactory } = require('@infra/database');
const { getSessionDateIST, formatISTTime } = require('@utils/timezoneHelper');
const { NotFoundError } = require('@utils/errors');
const { MARKET_STATUS, SESSION_PHASE, SESSION_STATUS, GAME_TYPE_PHASE } = require('@config/constants/domain');
const { compareBySessionCloseTime } = require('@domain/markets/marketSessionOrdering');

const marketRepository = RepositoryFactory.getRepository('Market');
const gameSessionRepository = RepositoryFactory.getRepository('GameSession');
const GlobalConfigRepo = RepositoryFactory.getRepository('GlobalConfig');
const GameTypeRepo = RepositoryFactory.getRepository('GameType');

const isUserVisibleSession = (session) =>
  session?.status === SESSION_STATUS.ACTIVE || session?.status === SESSION_STATUS.SETTLED;

const deriveAllowedGameTypes = (gameTypes = []) => gameTypes
  .filter((gameType) => gameType.status !== MARKET_STATUS.INACTIVE)
  .map((gameType) => gameType.code);

const getMarketsWithStatus = async () => {
  const markets = await marketRepository.findActiveWithGameTypes();

  const today = getSessionDateIST();
  const sessions = await gameSessionRepository.findTodayByMarketIds(
    markets.map((market) => market._id),
    today,
  );
  const sessionByMarketId = new Map(
    sessions.map((session) => [String(session.marketId), session]),
  );

  const marketStatuses = markets
    .filter((market) => sessionByMarketId.has(String(market._id)))
    .map((market) => {
      const session = sessionByMarketId.get(String(market._id)) || null;

      const result = session?.result
        ? {
          openPana: session.result.openPana,
          openDigit: session.result.openDigit,
          closePana: session.result.closePana,
          closeDigit: session.result.closeDigit,
        }
        : null;

      const gameTypesFromMarket = (market.gameTypes || [])
        .filter((gt) => gt?.gameTypeId)
        .map((gt) => ({
          id: gt.gameTypeId._id,
          code: gt.gameTypeId.code,
          name: gt.gameTypeId.name,
          payoutMultiplier:
          typeof gt.payoutMultiplier === 'number'
            ? gt.payoutMultiplier
            : gt.gameTypeId.payoutMultiplier,
          betPhaseType: gt.gameTypeId.betPhaseType || GAME_TYPE_PHASE.BOTH,
          status: gt.status || MARKET_STATUS.ACTIVE,
        }));
      const canPlaceOpenBets =
      session?.status === SESSION_STATUS.ACTIVE &&
      session?.phase === SESSION_PHASE.OPEN_RUNNING &&
      session?.openResultDeclared !== true;
      const allowedGameTypeDetails = gameTypesFromMarket.filter((gameType) => {
        if (gameType.status === MARKET_STATUS.INACTIVE) {
          return false;
        }
        if (gameType.betPhaseType === GAME_TYPE_PHASE.OPEN_ONLY) {
          return canPlaceOpenBets;
        }
        return true;
      });

      return {
        sortCloseTime: session?.closeTime ? new Date(session.closeTime).getTime() : Number.MAX_SAFE_INTEGER,
        marketId: market._id,
        name: market.name,
        code: market.code,
        openTime: market.openTime,
        closeTime: market.closeTime,
        gameTypes: allowedGameTypeDetails,
        allowedGameTypes: deriveAllowedGameTypes(gameTypesFromMarket),
        session: session
          ? {
            id: session._id,
            phase: session.phase,
            status: session.status,
            openTime: formatISTTime(session.openTime),
            closeTime: formatISTTime(session.closeTime),
            isOpen: session.status === SESSION_STATUS.ACTIVE
            && [SESSION_PHASE.OPEN_RUNNING, SESSION_PHASE.CLOSE_RUNNING].includes(session.phase),
          }
          : null,
        result,
      };
    });

  return marketStatuses
    .sort((left, right) => compareBySessionCloseTime(left, right, {
      getCloseTime: (market) => market.sortCloseTime,
      getName: (market) => market.name,
    }))
    .map((market) => {
      const normalizedMarket = { ...market };
      delete normalizedMarket.sortCloseTime;
      return normalizedMarket;
    });
};

const getTodaysResults = async () => {
  const sessionDate = getSessionDateIST();

  const sessions = await gameSessionRepository.findLean({ sessionDate });

  if (!sessions || sessions.length === 0) {
    return { date: sessionDate.toISOString().split('T')[0], results: [] };
  }

  const marketIds = [...new Set(sessions.map((sess) => String(sess.marketId)))];
  const markets = await marketRepository.findLeanByIds(marketIds, 'name code');
  const marketMap = Object.fromEntries(markets.map((market) => [String(market._id), market]));

  const results = sessions.filter(isUserVisibleSession).map((sess) => {
    const market = marketMap[String(sess.marketId)];

    const result = {
      openPana: sess.result?.openPana || null,
      openDigit: typeof sess.result?.openDigit === 'number' ? sess.result.openDigit : null,
      closePana: sess.result?.closePana || null,
      closeDigit: typeof sess.result?.closeDigit === 'number' ? sess.result.closeDigit : null,
    };

    let status = 'unknown';
    if (sess.phase === SESSION_PHASE.SETTLED) {
      status = SESSION_PHASE.SETTLED;
    } else if (sess.phase === SESSION_PHASE.MARKET_CLOSED) {
      status = SESSION_PHASE.MARKET_CLOSED;
    } else if (sess.phase === SESSION_PHASE.CLOSE_RUNNING) {
      status = SESSION_PHASE.CLOSE_RUNNING;
    } else if (sess.phase === SESSION_PHASE.OPEN_RUNNING) {
      status = sess.openResultDeclared ? 'open_declared' : SESSION_PHASE.OPEN_RUNNING;
    }

    return {
      marketId: market?._id,
      marketName: market?.name,
      marketCode: market?.code,
      sessionId: sess._id,
      phase: sess.phase,
      status,
      openTime: formatISTTime(sess.openTime),
      closeTime: formatISTTime(sess.closeTime),
      result,
    };
  });

  return { date: sessionDate.toISOString().split('T')[0], results };
};

const getMarketStatus = async (marketCode) => {
  const today = getSessionDateIST();
  const market = await marketRepository.findByCode(marketCode);

  if (!market || market.status !== MARKET_STATUS.ACTIVE) {
    throw new NotFoundError('Market not found or inactive');
  }

  const session = await gameSessionRepository.findOneLean({
    marketId: market._id,
    sessionDate: today,
    status: SESSION_STATUS.ACTIVE,
  });

  if (!session) {
    throw new NotFoundError('No session found for this market today');
  }

  const result = session.result
    ? {
      openPana: session.result.openPana,
      openDigit: session.result.openDigit,
      closePana: session.result.closePana,
      closeDigit: session.result.closeDigit,
    }
    : null;

  return {
    market: {
      id: market._id,
      name: market.name,
      code: market.code,
    },
    session: {
      id: session._id,
      phase: session.phase,
      status: session.status,
      openTime: formatISTTime(session.openTime),
      closeTime: formatISTTime(session.closeTime),
    },
    result,
  };
};

const getGameRates = async () => {
  const [cfg, gameTypes] = await Promise.all([
    GlobalConfigRepo.findOne({}),
    GameTypeRepo.findActiveLean(),
  ]);

  if (!cfg) {
    throw new NotFoundError('GlobalConfig not found');
  }

  return {
    gameTypes: (gameTypes || []).map((gt) => ({
      id: gt._id,
      code: gt.code,
      name: gt.name,
      payoutMultiplier: gt.payoutMultiplier,
    })),
  };
};

module.exports = {
  getMarketsWithStatus,
  getTodaysResults,
  getMarketStatus,
  getGameRates,
};

