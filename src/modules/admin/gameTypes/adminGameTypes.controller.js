const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils');
const service = require('./adminGameTypes.service');
const {
  ensureObjectId,
  validateCreateGameTypePayload,
  validateUpdateGameTypePayload,
  validateListGameTypesQuery,
} = require('./adminGameTypes.validator');

const listGameTypes = asyncHandler(async (req, res) => {
  const query = validateListGameTypesQuery(req.query);
  const result = await service.listGameTypes(query);
  return sendSuccess(res, result, 'Game types retrieved successfully');
});

const getGameType = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'gameTypeId');
  const gameType = await service.getGameType({ id: req.params.id });
  return sendSuccess(res, gameType, 'Game type retrieved successfully');
});

const createGameType = asyncHandler(async (req, res) => {
  const payload = validateCreateGameTypePayload(req.body);
  const gameType = await service.createGameType({
    payload,
    adminUserId: req.user.id,
    req,
  });
  return sendSuccess(res, gameType, 'Game type created successfully', 201);
});

const updateGameType = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'gameTypeId');
  const payload = validateUpdateGameTypePayload(req.body);
  const gameType = await service.updateGameType({
    id: req.params.id,
    payload,
    adminUserId: req.user.id,
    req,
  });
  return sendSuccess(res, gameType, 'Game type updated successfully');
});

const deleteGameType = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, 'gameTypeId');
  const result = await service.deleteGameType({
    id: req.params.id,
    adminUserId: req.user.id,
    req,
  });
  return sendSuccess(res, result, 'Game type deleted successfully');
});

module.exports = {
  listGameTypes,
  getGameType,
  createGameType,
  updateGameType,
  deleteGameType,
};
