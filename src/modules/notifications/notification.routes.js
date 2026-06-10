const express = require('express');
const router = express.Router();
const { requireAuth } = require('@middleware/auth');
const {
  registerDevice,
  updateDeviceToken,
  removeDevice,
} = require('./notification.controller');

router.post('/register-device', requireAuth, registerDevice);
router.put('/update-device', requireAuth, updateDeviceToken);
router.delete('/remove-device', requireAuth, removeDevice);

module.exports = router;
