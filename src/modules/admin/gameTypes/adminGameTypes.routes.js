const express = require('express');
const { requireAdminAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');
const controller = require('./adminGameTypes.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin Game Types
 *     description: Admin game type configuration APIs
 */
router.get('/', ...requireAdminAuth, userLimiter, controller.listGameTypes);
router.post('/', ...requireAdminAuth, userLimiter, controller.createGameType);
router.get('/:id', ...requireAdminAuth, userLimiter, controller.getGameType);

/**
 * @swagger
 * /admin/game-types/{id}:
 *   patch:
 *     summary: Update game type
 *     tags: [Admin, Admin Game Types]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Game type updated successfully
 */
router.patch('/:id', ...requireAdminAuth, userLimiter, controller.updateGameType);
router.delete('/:id', ...requireAdminAuth, userLimiter, controller.deleteGameType);

module.exports = router;
