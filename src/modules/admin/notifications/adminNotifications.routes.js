const express = require('express');
const { requireAdminAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');
const controller = require('./adminNotifications.controller');

const router = express.Router();

router.post('/', ...requireAdminAuth, userLimiter, controller.sendNotification);

module.exports = router;
