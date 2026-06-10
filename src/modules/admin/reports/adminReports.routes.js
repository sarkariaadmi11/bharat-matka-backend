const express = require('express');
const { requireAdminAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');
const controller = require('./adminReports.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin Reports
 *     description: Admin analytics and reporting APIs
 */

/**
 * @swagger
 * /admin/reports/bids:
 *   get:
 *     summary: Get bid report
 *     tags: [Admin, Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bid report retrieved
 */
router.get('/bids', ...requireAdminAuth, userLimiter, controller.getBidReport);

/**
 * @swagger
 * /admin/reports/winning-history:
 *   get:
 *     summary: Get winning history
 *     tags: [Admin, Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Winning history retrieved
 */
router.get('/winning-history', ...requireAdminAuth, userLimiter, controller.getWinningHistory);

module.exports = router;
