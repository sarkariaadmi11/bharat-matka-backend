const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils/response');
const resultService = require('./result.service');
const {
  validateOpenPayload,
  validateClosePayload,
  validateResetOpenPayload,
  validateResetClosePayload,
} = require('./result.validator');

const declareOpenResult = asyncHandler(async (req, res) => {
  validateOpenPayload(req.body);

  const data = await resultService.declareOpenResult({
    sessionId: req.params.sessionId,
    openPana: req.body.openPana,
    adminUserId: req.admin?._id || req.user?._id,
    reason: req.body.reason || 'Initial open result declaration',
  });

  sendSuccess(res, data, 'Open result declared successfully');
});

const declareCloseResult = asyncHandler(async (req, res) => {
  validateClosePayload(req.body);

  const data = await resultService.declareCloseResult({
    sessionId: req.params.sessionId,
    closePana: req.body.closePana,
    adminUserId: req.admin?._id || req.user?._id,
    reason: req.body.reason || 'Initial close result declaration',
  });

  sendSuccess(res, data, 'Close result declared successfully');
});

const resetOpenResult = asyncHandler(async (req, res) => {
  const payload = validateResetOpenPayload(req.body);

  const data = await resultService.resetOpenResult({
    sessionId: req.params.sessionId,
    adminUserId: req.user?.id || req.admin?.id,
    ...payload,
  });

  sendSuccess(res, data, 'Open result reset successfully');
});

const resetCloseResult = asyncHandler(async (req, res) => {
  const payload = validateResetClosePayload(req.body);

  const data = await resultService.resetCloseResult({
    sessionId: req.params.sessionId,
    adminUserId: req.user?.id || req.admin?.id,
    ...payload,
  });

  sendSuccess(res, data, 'Close result reset successfully');
});

const previewWinnersForResult = asyncHandler(async (req, res) => {
  const { sessionId, phase, pana } = req.params;
  const { page = 1, limit = 50 } = req.query;

  const data = await resultService.previewWinnersForResult({
    sessionId,
    phase,
    pana,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });

  sendSuccess(res, data, 'Winners preview generated successfully');
});

module.exports = {
  declareOpenResult,
  declareCloseResult,
  resetOpenResult,
  resetCloseResult,
  previewWinnersForResult,
};
