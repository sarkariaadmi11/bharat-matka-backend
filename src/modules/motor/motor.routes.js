const express = require('express');
const { requireAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');
const { generateMotor } = require('./motor.controller');

const router = express.Router();

router.post('/generate', requireAuth, userLimiter, generateMotor);

module.exports = router;
