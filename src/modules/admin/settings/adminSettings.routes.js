const express = require('express');
const { requireAdminAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');
const {
  getSupportContact,
  updateSupportContact,
  getSettings,
  updateSettings,
} = require('./adminSettings.controller');

const router = express.Router();

/**
 * ADMIN SETTINGS ROUTES
 * Base: /api/v1/admin/settings
 * All routes require admin authentication
 */

router.get('/support-contact',  userLimiter, getSupportContact);
router.patch('/support-contact', ...requireAdminAuth, userLimiter, updateSupportContact);

router.get('/', ...requireAdminAuth, userLimiter, getSettings);
router.put('/', ...requireAdminAuth, userLimiter, updateSettings);

module.exports = router;
