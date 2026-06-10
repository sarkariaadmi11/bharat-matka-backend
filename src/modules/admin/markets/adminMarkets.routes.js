const express = require('express');
const { requireAdminAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');
const controller = require('./adminMarkets.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin Markets
 *     description: Admin market configuration APIs
 */

router.get('/', ...requireAdminAuth, userLimiter, controller.getMarkets);
router.get('/:marketId/gametypes', ...requireAdminAuth, userLimiter, controller.getMarketGameTypes);
router.post('/', ...requireAdminAuth, userLimiter, controller.createMarket);

/**
 * @swagger
 * /admin/markets/{marketId}:
 *   patch:
 *     summary: Edit market configuration
 *     tags: [Admin, Admin Markets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: marketId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Market updated successfully
 */
router.patch('/:marketId', ...requireAdminAuth, userLimiter, controller.updateMarket);
router.delete('/:marketId', ...requireAdminAuth, userLimiter, controller.deleteMarket);

module.exports = router;
