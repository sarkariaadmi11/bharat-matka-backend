const { GameType, Market } = require('@infra/models');
const marketsSeed = require('@config/seed-definitions/markets.seed');
const { MARKET_STATUS } = require('@config/constants/domain');
const PREFIX = '[Migration:20260401_002]';

const summarizeMutation = (summary, kind) => {
  summary[kind] = (summary[kind] || 0) + 1;
};

const logAction = (message) => {
  console.log(`${PREFIX} ${message}`);
};

const normalizeMarketPayload = ({ definition, gameTypesByCode }) => {
  const orderedGameTypes = definition.gameTypeCodes.map((code) => {
    const gameType = gameTypesByCode.get(code);
    if (!gameType) {
      throw new Error(`Missing game type for market seed: ${code}`);
    }
    return gameType;
  });

  return {
    code: definition.code,
    name: definition.name,
    description: definition.description || '',
    schedule: definition.schedule,
    openTime: definition.openTime,
    closeTime: definition.closeTime,
    status: definition.status || MARKET_STATUS.ACTIVE,
    gameTypes: orderedGameTypes.map((item) => ({
      gameTypeId: item._id,
      status: MARKET_STATUS.ACTIVE,
    })),
  };
};

const sameMarketGameTypes = (left = [], right = []) =>
  JSON.stringify(
    left.map((item) => ({
      gameTypeId: String(item.gameTypeId),
      status: item.status,
    })).sort((a, b) => String(a.gameTypeId).localeCompare(String(b.gameTypeId))),
  ) === JSON.stringify(
    right.map((item) => ({
      gameTypeId: String(item.gameTypeId),
      status: item.status,
    })).sort((a, b) => String(a.gameTypeId).localeCompare(String(b.gameTypeId))),
  );

module.exports = {
  name: '20260401_002_market_seed',
  up: async () => {
    const summary = { created: 0, updated: 0, skipped: 0 };
    const gameTypes = await GameType.find({}).lean();
    const gameTypesByCode = new Map(gameTypes.map((item) => [item.code, item]));

    for (const definition of marketsSeed) {
      let payload;
      try {
        payload = normalizeMarketPayload({ definition, gameTypesByCode });
      } catch (error) {
        console.error(`${PREFIX} Market ${definition.code} failed: ${error.message}`);
        throw error;
      }

      const existing = await Market.findOne({ code: definition.code }).lean();

      if (!existing) {
        await Market.create(payload);
        summarizeMutation(summary, 'created');
        logAction(`Market ${definition.code} created`);
        continue;
      }

      const changed = existing.name !== payload.name
        || (existing.description || '') !== payload.description
        || existing.openTime !== payload.openTime
        || existing.closeTime !== payload.closeTime
        || existing.status !== payload.status
        || JSON.stringify(existing.schedule || {}) !== JSON.stringify(payload.schedule || {})
        || !sameMarketGameTypes(existing.gameTypes || [], payload.gameTypes || []);

      if (!changed) {
        summarizeMutation(summary, 'skipped');
        logAction(`Market ${definition.code} skipped`);
        continue;
      }

      await Market.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: payload.name,
            description: payload.description,
            openTime: payload.openTime,
            closeTime: payload.closeTime,
            schedule: payload.schedule,
            status: payload.status,
            gameTypes: payload.gameTypes,
          },
        },
      );
      summarizeMutation(summary, 'updated');
      logAction(`Market ${definition.code} updated`);
    }

    console.log(`${PREFIX} Summary`, summary);
  },
  down: async () => {
    throw new Error('Down migrations are not supported for fresh-cluster seed migrations.');
  },
};
