const { RepositoryFactory } = require('@infra/database');
const { MARKET_STATUS } = require('@config/constants/domain');
const { NotFoundError, ValidationError, ConflictError } = require('@utils/errors');
const { writeAuditLog } = require('@modules/admin/logs/logs.service');

const gameTypeRepository = RepositoryFactory.getRepository('GameType');

const ADMIN_GAME_TYPE_ACTION = Object.freeze({
  CREATE: 'GAME_TYPE_CREATE',
  UPDATE: 'GAME_TYPE_UPDATE',
  SOFT_DELETE: 'GAME_TYPE_SOFT_DELETE',
});

const serializeGameType = (gameType) => ({
  gameTypeId: String(gameType._id),
  code: gameType.code,
  name: gameType.name,
  templateKey: gameType.templateKey,
  rulesVersion: gameType.rulesVersion,
  payoutMultiplier: gameType.payoutMultiplier,
  minBet: gameType.minBet,
  maxBet: gameType.maxBet,
  betPhaseType: gameType.betPhaseType,
  rules: gameType.rules,
  status: gameType.status,
  enabled: gameType.status === MARKET_STATUS.ACTIVE,
  createdAt: gameType.createdAt,
  updatedAt: gameType.updatedAt,
});

const ensureBetLimits = ({ minBet, maxBet }) => {
  if (
    typeof minBet === 'number'
    && typeof maxBet === 'number'
    && minBet > maxBet
  ) {
    throw new ValidationError('minBet must be less than or equal to maxBet');
  }
};

const writeAdminAudit = async ({ req, userId, message, meta }) => writeAuditLog({
  message,
  requestId: req?.id,
  userId,
  route: req?.originalUrl,
  method: req?.method,
  ip: req?.ip,
  meta,
});

const getGameTypeOrThrow = async (id) => {
  const gameType = await gameTypeRepository.findById(id);
  if (!gameType) {
    throw new NotFoundError('GameType not found');
  }
  return gameType;
};

const listGameTypes = async ({ status } = {}) => {
  const filter = status ? { status } : {};
  const rows = await gameTypeRepository.findForAdminList(filter);

  return {
    gameTypes: rows.map(serializeGameType),
  };
};

const getGameType = async ({ id }) => {
  const gameType = await getGameTypeOrThrow(id);
  return serializeGameType(gameType);
};

const createGameType = async ({ payload, adminUserId, req }) => {
  const existing = await gameTypeRepository.findByCode(payload.code);
  if (existing) {
    throw new ConflictError('GameType code already exists');
  }

  ensureBetLimits(payload);

  const created = await gameTypeRepository.create({
    code: payload.code,
    name: payload.name,
    templateKey: payload.templateKey,
    payoutMultiplier: payload.payoutMultiplier,
    minBet: payload.minBet,
    maxBet: payload.maxBet,
    status: payload.status || MARKET_STATUS.ACTIVE,
  });

  await writeAdminAudit({
    req,
    userId: adminUserId,
    message: 'Game type created',
    meta: {
      category: 'ADMIN_OP',
      action: ADMIN_GAME_TYPE_ACTION.CREATE,
      gameTypeCode: created.code,
    },
  });

  return serializeGameType(created);
};

const updateGameType = async ({ id, payload, adminUserId, req }) => {
  const existing = await getGameTypeOrThrow(id);

  if (payload.code !== undefined) {
    const existingByCode = await gameTypeRepository.findByCode(payload.code);
    if (existingByCode && String(existingByCode._id) !== String(existing._id)) {
      throw new ConflictError('GameType code already exists');
    }
  }

  const nextMinBet = payload.minBet ?? existing.minBet;
  const nextMaxBet = payload.maxBet ?? existing.maxBet;
  ensureBetLimits({ minBet: nextMinBet, maxBet: nextMaxBet });

  const update = { ...payload };
  if (Object.prototype.hasOwnProperty.call(payload, 'enabled')) {
    update.status = payload.enabled ? MARKET_STATUS.ACTIVE : MARKET_STATUS.INACTIVE;
    delete update.enabled;
  }

  const updated = await gameTypeRepository.updateById(id, update);

  await writeAdminAudit({
    req,
    userId: adminUserId,
    message: 'Game type updated',
    meta: {
      category: 'ADMIN_OP',
      action: ADMIN_GAME_TYPE_ACTION.UPDATE,
      gameTypeCode: updated.code,
      changes: Object.keys(payload),
    },
  });

  return serializeGameType(updated);
};

const deleteGameType = async ({ id, adminUserId, req }) => {
  const gameType = await getGameTypeOrThrow(id);

  if (gameType.status !== MARKET_STATUS.INACTIVE) {
    await gameTypeRepository.updateById(id, { status: MARKET_STATUS.INACTIVE });
  }

  const updated = await getGameTypeOrThrow(id);

  await writeAdminAudit({
    req,
    userId: adminUserId,
    message: 'Game type marked inactive',
    meta: {
      category: 'ADMIN_OP',
      action: ADMIN_GAME_TYPE_ACTION.SOFT_DELETE,
      gameTypeCode: updated.code,
    },
  });

  return {
    gameTypeId: String(updated._id),
    status: updated.status,
  };
};

module.exports = {
  listGameTypes,
  getGameType,
  createGameType,
  updateGameType,
  deleteGameType,
  serializeGameType,
};
