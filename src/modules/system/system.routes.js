const express = require('express');
const router = express.Router();
const { heartbeat } = require('./system.controller');

/**
 * @swagger
 * tags:
 *   name: System
 *   description: Internal system and maintenance endpoints
 */

/**
 * @swagger
 * /system/heartbeat:
 *   get:
 *     summary: Trigger background task processing
 *     description: |
 *       Internal endpoint used to trigger background task execution
 *       (settlement, market locks, session creation).
 *       Does not block the request lifecycle.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Task runner triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.get('/heartbeat', heartbeat);

module.exports = router;
