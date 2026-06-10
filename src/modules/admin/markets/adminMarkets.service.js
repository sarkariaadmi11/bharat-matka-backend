const mongoose = require('mongoose');
const { RepositoryFactory } = require('@infra/database');
const { GAME_TYPE_PHASE, MARKET_STATUS, SESSION_PHASE, SESSION_STATUS } = require('@config/constants/domain');
const { NotFoundError, ValidationError, ConflictError } = require('@utils/errors');
const { writeAuditLog } = require('@modules/admin/logs/logs.service');
const { getSessionDateIST, formatISTTime, buildTimeOnSessionDate } = require('@utils/timezoneHelper');
const { compareBySessionCloseTime } = require('@domain/markets/marketSessionOrdering');
const {
  buildWeeklySchedule,
  applyScheduleUpdate,
  validateMarketTiming,
} = require('@domain/markets/marketSchedule');

const marketRepository = RepositoryFactory.getRepository('Market');
const gameTypeRepository = RepositoryFactory.getRepository('GameType');
const gameSessionRepository = RepositoryFactory.getRepository('GameSession');

const ADMIN_MARKET_ACTION = Object.freeze({
  CREATE: 'MARKET_CREATE',
  UPDATE: 'MARKET_UPDATE',
  SOFT_DELETE: 'MARKET_SOFT_DELETE',
});

const deriveAllowedGameTypes = (gameTypes = []) => gameTypes
  .filter((entry) => entry?.status !== MARKET_STATUS.INACTIVE && entry?.code)
  .map((entry) => entry.code);

const mapResolvedGameType = (entry = {}) => {
  const resolvedGameType = entry.gameTypeId || {};

  return {
    gameTypeId: resolvedGameType._id || entry.gameTypeId,
    code: resolvedGameType.code || null,
    name: resolvedGameType.name || null,
    betPhaseType: resolvedGameType.betPhaseType || GAME_TYPE_PHASE.BOTH,
    payoutMultiplier:
      typeof entry.payoutMultiplier === 'number'
        ? entry.payoutMultiplier
        : resolvedGameType.payoutMultiplier ?? null,
    minBet: typeof entry.minBet === 'number' ? entry.minBet : resolvedGameType.minBet ?? null,
    maxBet: typeof entry.maxBet === 'number' ? entry.maxBet : resolvedGameType.maxBet ?? null,
    status: entry.status || MARKET_STATUS.ACTIVE,
  };
};

const serializeMarket = (market) => {
  const gameTypes = (market.gameTypes || [])
    .filter((entry) => entry?.gameTypeId)
    .map(mapResolvedGameType);

  return {
    code: market.code,
    name: market.name,
    marketName: market.name,
    description: market.description || '',
    openTime: market.openTime,
    closeTime: market.closeTime,
    schedule: market.schedule || null,
    gameTypes,
    allowedGameTypes: deriveAllowedGameTypes(gameTypes),
    status: market.status,
    createdAt: market.createdAt,
    updatedAt: market.updatedAt,
  };
};

const normalizeGameTypeIdentifier = (value) => String(value || '').trim();

const resolveGameTypes = async (identifiers = []) => {
  if (!Array.isArray(identifiers) || identifiers.length === 0) {
    return [];
  }

  const objectIds = identifiers
    .map(normalizeGameTypeIdentifier)
    .filter((value) => mongoose.Types.ObjectId.isValid(value));
  const codes = identifiers
    .map(normalizeGameTypeIdentifier)
    .filter((value) => value && !mongoose.Types.ObjectId.isValid(value))
    .map((value) => value.toUpperCase());

  const query = {
    $or: [
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
      ...(codes.length ? [{ code: { $in: codes } }] : []),
    ],
  };

  const gameTypes = await gameTypeRepository.findForAdminList(query);
  if (gameTypes.length !== identifiers.length) {
    throw new ValidationError('One or more gameTypes are invalid');
  }

  return gameTypes;
};

const validateConfiguredGameTypeRanges = (gameTypes = []) => {
  gameTypes.forEach((entry) => {
    if (
      typeof entry.minBet === 'number'
      && typeof entry.maxBet === 'number'
      && entry.minBet > entry.maxBet
    ) {
      throw new ValidationError(`minBet cannot exceed maxBet for game type ${entry.gameTypeId}`);
    }
  });
};

const resolveConfiguredGameTypes = async (entries = []) => {
  const identifiers = entries.map((entry) => entry.gameTypeId);
  const resolvedGameTypes = await resolveGameTypes(identifiers);
  const byId = new Map(resolvedGameTypes.map((gameType) => [String(gameType._id), gameType]));
  const byCode = new Map(resolvedGameTypes.map((gameType) => [String(gameType.code).toUpperCase(), gameType]));

  const configuredGameTypes = entries.map((entry) => {
    const normalizedIdentifier = normalizeGameTypeIdentifier(entry.gameTypeId);
    const resolvedGameType = mongoose.Types.ObjectId.isValid(normalizedIdentifier)
      ? byId.get(normalizedIdentifier)
      : byCode.get(normalizedIdentifier.toUpperCase());

    if (!resolvedGameType) {
      throw new ValidationError(`Invalid gameTypeId ${entry.gameTypeId}`);
    }

    return {
      gameTypeId: resolvedGameType._id,
      payoutMultiplier: entry.payoutMultiplier ?? resolvedGameType.payoutMultiplier ?? null,
      minBet: entry.minBet ?? resolvedGameType.minBet ?? null,
      maxBet: entry.maxBet ?? resolvedGameType.maxBet ?? null,
      status: entry.status || MARKET_STATUS.ACTIVE,
    };
  });

  const uniqueIds = new Set(configuredGameTypes.map((entry) => String(entry.gameTypeId)));
  if (uniqueIds.size !== configuredGameTypes.length) {
    throw new ValidationError('Duplicate gameTypeId entries are not allowed');
  }

  validateConfiguredGameTypeRanges(configuredGameTypes);
  return configuredGameTypes;
};

const loadMarketOrThrow = async (marketId) => {
  const market = await marketRepository.findByIdWithGameTypes(marketId);
  if (!market) {
    throw new NotFoundError('Market not found');
  }
  return market;
};

const loadMarketByCode = async (code) => marketRepository.findByCode(String(code || '').trim().toUpperCase());

const writeAdminAudit = async ({ req, userId, message, meta }) => writeAuditLog({
  message,
  requestId: req?.id,
  userId,
  route: req?.originalUrl,
  method: req?.method,
  ip: req?.ip,
  meta,
});

const editMarket = async ({ marketId, payload, adminUserId, req }) => {
  const market = await loadMarketOrThrow(marketId);

  if (payload.code !== undefined) {
    const existingByCode = await loadMarketByCode(payload.code);
    if (existingByCode && String(existingByCode._id) !== String(market._id)) {
      throw new ConflictError('Market code already exists');
    }
    market.code = payload.code;
  }

  const nextName = payload.name ?? payload.marketName;
  if (nextName !== undefined) {
    market.name = nextName;
  }

  if (payload.description !== undefined) {
    market.description = payload.description;
  }

  if (payload.status !== undefined) {
    market.status = payload.status;
  }

  if (payload.openTime !== undefined || payload.closeTime !== undefined) {
    const nextOpenTime = payload.openTime ?? market.openTime;
    const nextCloseTime = payload.closeTime ?? market.closeTime;
    validateMarketTiming(nextOpenTime, nextCloseTime);
    market.openTime = nextOpenTime;
    market.closeTime = nextCloseTime;
  }

  if (payload.schedule !== undefined) {
    const newSchedule = applyScheduleUpdate(market.schedule || {}, payload.schedule);
    market.set('schedule', newSchedule);
  }

  if (payload.gameTypes !== undefined) {
    market.gameTypes = await resolveConfiguredGameTypes(payload.gameTypes);
  }

  await market.save();
  const populated = await loadMarketOrThrow(marketId);

  if (payload.openTime !== undefined && String(populated.openTime) !== String(payload.openTime)) {
    throw new Error(`Market update verification failed: openTime ${populated.openTime} !== ${payload.openTime}`);
  }
  if (payload.closeTime !== undefined && String(populated.closeTime) !== String(payload.closeTime)) {
    throw new Error(`Market update verification failed: closeTime ${populated.closeTime} !== ${payload.closeTime}`);
  }

  await writeAdminAudit({
    req,
    userId: adminUserId,
    message: 'Market updated',
    meta: {
      category: 'ADMIN_OP',
      action: ADMIN_MARKET_ACTION.UPDATE,
      marketCode: populated.code,
      changes: Object.keys(payload),
    },
  });

  return {
    marketId: String(populated._id),
    ...serializeMarket(populated),
  };
};

const createMarket = async ({ payload, adminUserId, req }) => {
  const existingByCode = await loadMarketByCode(payload.code);
  if (existingByCode) {
    throw new ConflictError('Market code already exists');
  }

  validateMarketTiming(payload.openTime, payload.closeTime);
  const gameTypes = await resolveConfiguredGameTypes(payload.gameTypes);
  const created = await marketRepository.create({
    code: payload.code,
    name: payload.name,
    description: payload.description || '',
    openTime: payload.openTime,
    closeTime: payload.closeTime,
    schedule: buildWeeklySchedule(payload.schedule),
    gameTypes,
    status: payload.status || MARKET_STATUS.ACTIVE,
  });

  const populated = await loadMarketOrThrow(created._id);

  await writeAdminAudit({
    req,
    userId: adminUserId,
    message: 'Market created',
    meta: {
      category: 'ADMIN_OP',
      action: ADMIN_MARKET_ACTION.CREATE,
      marketCode: populated.code,
    },
  });

  return {
    marketId: String(populated._id),
    ...serializeMarket(populated),
  };
};

const getAdminMarkets = async ({ status } = {}) => {
  const filter = status ? { status } : { status: MARKET_STATUS.ACTIVE };
  const markets = await marketRepository.findAllWithGameTypes(filter);
  const marketIds = markets.map((market) => market._id);

  const sessionDate = getSessionDateIST();
  const sessions = await gameSessionRepository.findTodayByMarketIds(marketIds, sessionDate);

  const sessionByMarketId = sessions.reduce((acc, session) => {
    acc.set(String(session.marketId), session);
    return acc;
  }, new Map());

  const serialized = markets.map((market) => {
    const session = sessionByMarketId.get(String(market._id));

    const closeTimeDate = session?.closeTime
      ? new Date(session.closeTime)
      : buildTimeOnSessionDate(sessionDate, market.closeTime);

    return {
      sortCloseTime: closeTimeDate?.getTime() ?? Number.MAX_SAFE_INTEGER,
      marketId: String(market._id),
      name: market.name,
      code: market.code,
      openTime: market.openTime,
      closeTime: market.closeTime,
      schedule: market.schedule || null,
      session: session
        ? {
          id: String(session._id),
          phase: session.phase,
          status: session.status,
          openTime: formatISTTime(session.openTime),
          closeTime: formatISTTime(session.closeTime),
          isOpen:
            session.status === SESSION_STATUS.ACTIVE
            && [SESSION_PHASE.OPEN_RUNNING, SESSION_PHASE.CLOSE_RUNNING].includes(session.phase),
        }
        : null,
      result: session
        ? {
          openPana: session.result?.openPana || null,
          openDigit: session.result?.openDigit ?? null,
          closePana: session.result?.closePana || null,
          closeDigit: session.result?.closeDigit ?? null,
        }
        : null,
    };
  });

  return serialized
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

const deleteMarket = async ({ marketId, adminUserId, req }) => {
  const market = await loadMarketOrThrow(marketId);

  if (market.status !== MARKET_STATUS.INACTIVE) {
    await marketRepository.update(marketId, { status: MARKET_STATUS.INACTIVE });
  }

  const updatedMarket = await loadMarketOrThrow(marketId);

  await writeAdminAudit({
    req,
    userId: adminUserId,
    message: 'Market marked inactive',
    meta: {
      category: 'ADMIN_OP',
      action: ADMIN_MARKET_ACTION.SOFT_DELETE,
      marketCode: updatedMarket.code,
    },
  });

  return {
    marketId: String(updatedMarket._id),
    status: updatedMarket.status,
  };
};

const getMarketGameTypes = async (marketId) => {
  const market = await loadMarketOrThrow(marketId);

  const gameTypes = (market.gameTypes || [])
    .filter((entry) => entry?.gameTypeId)
    .map(mapResolvedGameType);

  return {
    marketId: String(market._id),
    marketCode: market.code,
    marketName: market.name,
    gameTypes,
    allowedGameTypes: deriveAllowedGameTypes(gameTypes),
  };
};

module.exports = {
  createMarket,
  getAdminMarkets,
  getMarketGameTypes,
  deleteMarket,
  editMarket,
  serializeMarket,
};
