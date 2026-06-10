const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils/response');
const adminSettingsService = require('./adminSettings.service');
const { validateSupportContactPayload, validateSettingsPayload } = require('./adminSettings.validator');

const getSupportContact = asyncHandler(async (req, res) => {
  const result = await adminSettingsService.getSupportContact();
  sendSuccess(res, result, 'Support contact settings retrieved');
});

const updateSupportContact = asyncHandler(async (req, res) => {
  const payload = validateSupportContactPayload(req.body);
  const result = await adminSettingsService.updateSupportContact(payload);
  sendSuccess(res, result, 'Support contact settings updated');
});

const getSettings = asyncHandler(async (req, res) => {
  const result = await adminSettingsService.getSettings();
  sendSuccess(res, result, 'Settings retrieved');
});

const updateSettings = asyncHandler(async (req, res) => {
  const payload = validateSettingsPayload(req.body);
  const result = await adminSettingsService.updateSettings(payload);
  sendSuccess(res, result, 'Settings updated');
});

module.exports = {
  getSupportContact,
  updateSupportContact,
  getSettings,
  updateSettings,
};
