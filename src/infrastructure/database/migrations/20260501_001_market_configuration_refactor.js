const { DateTime } = require('luxon');
const { Market, GameSession, GameType } = require('@infra/models');
const { GAME_TYPE_PHASE, MARKET_STATUS } = require('@config/constants/domain');
const { BUSINESS_TIMEZONE } = require('@utils/timezoneHelper');
const { WEEKDAY_KEYS, buildWeeklySchedule, validateMarketTiming } = require('@domain/markets/marketSchedule');

const MIGRATION_NAME = '20260501_001_market_configuration_refactor';
const PREFIX = `[Migration:${MIGRATION_NAME}]`;
const DRY_RUN_ENABLED = String(process.env.MARKET_CONFIG_SIMPLIFICATION_DRY_RUN || 'false').toLowerCase() === 'true';

const ACTIVE_INACTIVE_STATUSES = new Set([MARKET_STATUS.ACTIVE, MARKET_STATUS.INACTIVE]);

const log = (message, meta = null) => {
  if (meta) {
    console.log(`${PREFIX} ${message}`, meta);
    return;
  }

  console.log(`${PREFIX} ${message}`);
};

const normalizeStatus = (status) => (
  ACTIVE_INACTIVE_STATUSES.has(status) ? status : MARKET_STATUS.INACTIVE
);

const isFlatTimeWindowSchedule = (schedule = {}) => (
  !!schedule
  && typeof schedule === 'object'
  && !Array.isArray(schedule)
  && typeof schedule.open === 'string'
  && typeof schedule.close === 'string'
  && !WEEKDAY_KEYS.some((weekday) => Object.prototype.hasOwnProperty.call(schedule, weekday))
);

const extractScheduleWindows = (schedule = {}) => {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    return { activeDays: buildWeeklySchedule({}), windows: [] };
  }

  if (isFlatTimeWindowSchedule(schedule)) {
    return {
      activeDays: buildWeeklySchedule(
        WEEKDAY_KEYS.reduce((accumulator, weekday) => {
          accumulator[weekday] = true;
          return accumulator;
        }, {}),
      ),
      windows: [{ open: schedule.open, close: schedule.close }],
    };
  }

  const activeDays = {};
  const windows = [];

  WEEKDAY_KEYS.forEach((weekday) => {
    const value = schedule[weekday];

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      activeDays[weekday] = true;
      if (typeof value.open === 'string' && typeof value.close === 'string') {
        windows.push({ open: value.open, close: value.close });
      }
      return;
    }

    activeDays[weekday] = value === true;
  });

  return {
    activeDays: buildWeeklySchedule(activeDays),
    windows,
  };
};

const getDistinctWindows = (windows = []) => {
  const distinct = new Map();

  windows.forEach((window) => {
    if (!window?.open || !window?.close) {
      return;
    }

    validateMarketTiming(window.open, window.close);
    distinct.set(`${window.open}-${window.close}`, window);
  });

  return [...distinct.values()];
};

const isBooleanWeeklySchedule = (schedule = {}) => {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    return false;
  }

  return WEEKDAY_KEYS.every((weekday) => typeof schedule[weekday] === 'boolean');
};

const mapConfiguredGameTypes = ({ market, gameTypesById, currentGameTypes = [] }) => {
  if (Array.isArray(currentGameTypes) && currentGameTypes.length > 0) {
    return currentGameTypes.map((entry) => ({
      gameTypeId: entry.gameTypeId,
      payoutMultiplier: entry.payoutMultiplier ?? null,
      minBet: entry.minBet ?? null,
      maxBet: entry.maxBet ?? null,
      status: normalizeStatus(entry.status),
    }));
  }

  return (Array.isArray(market.marketGameTypes) ? market.marketGameTypes : [])
    .map((entry) => {
      const gameTypeId = String(entry.gameTypeId?._id || entry.gameTypeId);
      const gameType = gameTypesById.get(gameTypeId);
      if (!gameType) {
        return null;
      }

      return {
        gameTypeId: gameType._id,
        payoutMultiplier: entry.payoutMultiplier ?? gameType.payoutMultiplier ?? null,
        minBet: entry.minBet ?? gameType.minBet ?? null,
        maxBet: entry.maxBet ?? gameType.maxBet ?? null,
        status: normalizeStatus(entry.status),
      };
    })
    .filter(Boolean);
};

const hasTargetMarketShape = (market = {}) => (
  typeof market.openTime === 'string'
  && typeof market.closeTime === 'string'
  && isBooleanWeeklySchedule(market.schedule)
  && Array.isArray(market.gameTypes)
  && !Object.prototype.hasOwnProperty.call(market, 'allowedGameTypes')
  && !Object.prototype.hasOwnProperty.call(market, 'marketGameTypes')
);

const formatTimeSnapshot = (date) => DateTime
  .fromJSDate(date, { zone: BUSINESS_TIMEZONE })
  .toFormat('HH:mm');

const buildSessionGameTypeSnapshots = ({ session, market, gameTypesById }) => {
  if (
    Array.isArray(session.gameTypesSnapshot)
    && session.gameTypesSnapshot.length > 0
    && session.gameTypesSnapshot.every((entry) => entry?.code && entry?.name && entry?.betPhaseType)
  ) {
    return session.gameTypesSnapshot.map((entry) => ({
      ...entry,
      status: normalizeStatus(entry.status),
      betPhaseType: entry.betPhaseType || GAME_TYPE_PHASE.BOTH,
    }));
  }

  const sourceGameTypes = Array.isArray(market.gameTypes) && market.gameTypes.length > 0
    ? market.gameTypes
    : mapConfiguredGameTypes({ market, gameTypesById });

  return sourceGameTypes.map((entry) => {
    const gameType = gameTypesById.get(String(entry.gameTypeId));
    if (!gameType) {
      return null;
    }

    return {
      gameTypeId: gameType._id,
      code: gameType.code,
      name: gameType.name,
      betPhaseType: gameType.betPhaseType || GAME_TYPE_PHASE.BOTH,
      payoutMultiplier: entry.payoutMultiplier ?? gameType.payoutMultiplier ?? null,
      minBet: entry.minBet ?? gameType.minBet ?? null,
      maxBet: entry.maxBet ?? gameType.maxBet ?? null,
      status: normalizeStatus(entry.status),
    };
  }).filter(Boolean);
};

const hasTargetSessionShape = (session = {}) => (
  typeof session.openTimeSnapshot === 'string'
  && typeof session.closeTimeSnapshot === 'string'
  && Array.isArray(session.gameTypesSnapshot)
  && session.gameTypesSnapshot.every((entry) => entry?.code && entry?.name && entry?.betPhaseType)
);

module.exports = {
  name: MIGRATION_NAME,
  shouldSkipMarkApplied: () => DRY_RUN_ENABLED,
  up: async () => {
    const summary = {
      dryRun: DRY_RUN_ENABLED,
      migratedMarkets: 0,
      skippedMarkets: 0,
      blockedMarkets: [],
      migratedSessions: 0,
      skippedSessions: 0,
    };

    const markets = await Market.find({}).lean();
    const gameTypes = await GameType.find({}).lean();
    const gameTypesById = new Map(gameTypes.map((gameType) => [String(gameType._id), gameType]));
    const marketBulkOps = [];
    const migratedMarketMap = new Map();

    for (const market of markets) {
      if (hasTargetMarketShape(market)) {
        summary.skippedMarkets += 1;
        migratedMarketMap.set(String(market._id), market);
        continue;
      }

      const { activeDays, windows } = extractScheduleWindows(market.schedule || {});
      const distinctWindows = getDistinctWindows(windows);

      if (!market.openTime || !market.closeTime) {
        if (distinctWindows.length !== 1) {
          summary.blockedMarkets.push({
            marketId: String(market._id),
            code: market.code,
            reason: 'multiple_distinct_schedule_windows',
          });
          continue;
        }
      }

      const openTime = market.openTime || distinctWindows[0]?.open;
      const closeTime = market.closeTime || distinctWindows[0]?.close;
      validateMarketTiming(openTime, closeTime);

      const nextGameTypes = mapConfiguredGameTypes({
        market,
        gameTypesById,
        currentGameTypes: Array.isArray(market.gameTypes) ? market.gameTypes : [],
      });

      const nextMarket = {
        ...market,
        openTime,
        closeTime,
        schedule: activeDays,
        gameTypes: nextGameTypes,
        status: normalizeStatus(market.status),
      };

      migratedMarketMap.set(String(market._id), nextMarket);
      summary.migratedMarkets += 1;

      if (!DRY_RUN_ENABLED) {
        marketBulkOps.push({
          updateOne: {
            filter: { _id: market._id },
            update: {
              $set: {
                openTime,
                closeTime,
                schedule: activeDays,
                gameTypes: nextGameTypes,
                status: normalizeStatus(market.status),
              },
              $unset: {
                allowedGameTypes: '',
                marketGameTypes: '',
              },
            },
          },
        });
      }
    }

    if (!DRY_RUN_ENABLED && marketBulkOps.length > 0) {
      await Market.bulkWrite(marketBulkOps);
    }

    const sessions = await GameSession.find({}).lean();
    const sessionBulkOps = [];

    for (const session of sessions) {
      const market = migratedMarketMap.get(String(session.marketId));
      if (!market) {
        summary.skippedSessions += 1;
        continue;
      }

      if (hasTargetSessionShape(session)) {
        summary.skippedSessions += 1;
        continue;
      }

      const openTimeSnapshot = session.openTimeSnapshot
        || session.scheduleSnapshot?.open
        || formatTimeSnapshot(session.openTime);
      const closeTimeSnapshot = session.closeTimeSnapshot
        || session.scheduleSnapshot?.close
        || formatTimeSnapshot(session.closeTime);
      const gameTypesSnapshot = buildSessionGameTypeSnapshots({
        session,
        market,
        gameTypesById,
      });

      summary.migratedSessions += 1;

      if (!DRY_RUN_ENABLED) {
        sessionBulkOps.push({
          updateOne: {
            filter: { _id: session._id },
            update: {
              $set: {
                openTimeSnapshot,
                closeTimeSnapshot,
                gameTypesSnapshot,
              },
              $unset: {
                scheduleSnapshot: '',
              },
            },
          },
        });
      }
    }

    if (!DRY_RUN_ENABLED && sessionBulkOps.length > 0) {
      await GameSession.bulkWrite(sessionBulkOps);
    }

    log('Summary', summary);

    if (summary.blockedMarkets.length > 0) {
      log('Blocked markets require manual repair', summary.blockedMarkets);
    }
  },
  down: async () => {
    throw new Error('Down migrations are not supported. Rollback requires collection restore from backup.');
  },
};
