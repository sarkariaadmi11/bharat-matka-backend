/**
 * Auth Routes
 * User authentication and authorization
 */

const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { requireAuth } = require('@middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/change-password', requireAuth, authController.changePassword);
router.post('/logout', requireAuth, authController.logout);
router.delete('/delete-account', requireAuth, authController.deleteAccount);

module.exports = router;
