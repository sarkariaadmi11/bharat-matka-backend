const express = require('express');
const router = express.Router();

const {
  createDailySessions,
  getDailySessionCreationStatus,
  cancelSession,
  getAdminSessionsOverview,
} = require('./sessions.controller');
const { requireAuth, requireAdmin } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');

router.post('/daily/run', requireAuth, userLimiter, requireAdmin, createDailySessions);
router.get('/daily/status', requireAuth, userLimiter, requireAdmin, getDailySessionCreationStatus);
router.get('/', requireAuth, userLimiter, requireAdmin, getAdminSessionsOverview);
router.post('/:sessionId/cancel', requireAuth, userLimiter, requireAdmin, cancelSession);

module.exports = router;

