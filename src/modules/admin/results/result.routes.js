const express = require('express');
const { requireAdminAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');
const {
  declareOpenResult,
  declareCloseResult,
  resetOpenResult,
  resetCloseResult,
  previewWinnersForResult,
} = require('./result.controller');
const {
  simulateResults,
} = require('../simulation/resultSimulation.controller');
const {
  createAndExecuteRevertBatch,
  listRevertBatches,
  getRevertBatchStatus,
  listBidHistory,
  createAndEnqueueRevertAll,
} = require('./revertBatch.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin Results
 *     description: Admin result declaration APIs
 *   - name: Admin Simulation
 *     description: Admin result simulation APIs
 */

/**
 * @swagger
 * /admin/results/sessions/{sessionId}/open:
 *   post:
 *     summary: Declare open result
 *     description: Declare open pana, auto-derive open digit, create a tracked settlement job, and return immediate settlement visibility.
 *     tags: [Admin, Admin Results]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeclareOpenResultRequest'
 *     responses:
 *       200:
 *         description: Open result declared
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AdminResultDeclarationData'
 *       400:
 *         description: Invalid request/session phase
 *       404:
 *         description: Session not found
 */
router.post('/sessions/:sessionId/open', ...requireAdminAuth, userLimiter, declareOpenResult);

/**
 * @swagger
 * /admin/results/sessions/{sessionId}/close:
 *   post:
 *     summary: Declare close result
 *     description: Declare close pana, auto-derive close digit, create a tracked settlement job, and return immediate settlement visibility.
 *     tags: [Admin, Admin Results]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeclareCloseResultRequest'
 *     responses:
 *       200:
 *         description: Close result declared
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AdminResultDeclarationData'
 *       400:
 *         description: Invalid request/session phase
 *       404:
 *         description: Session not found
 */
router.post('/sessions/:sessionId/close', ...requireAdminAuth, userLimiter, declareCloseResult);

router.post('/sessions/:sessionId/reset-open', ...requireAdminAuth, userLimiter, resetOpenResult);

router.post('/sessions/:sessionId/reset-close', ...requireAdminAuth, userLimiter, resetCloseResult);

/**
 * @swagger
 * /admin/results/sessions/{sessionId}/simulate:
 *   post:
 *     summary: Simulate top profitable outcomes
 *     description: Simulate outcomes and return top 10 profitable combinations sorted by profit desc.
 *     tags: [Admin, Admin Simulation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Simulation completed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AdminSimulationData'
 *       400:
 *         description: Invalid request/session phase
 *       404:
 *         description: Session not found
 */
router.post('/sessions/:sessionId/simulate', ...requireAdminAuth, userLimiter, simulateResults);

/**
 * @swagger
 * /admin/results/sessions/{sessionId}/preview-winners/{phase}/{pana}:
 *   get:
 *     summary: Preview winners for a specific result before declaring
 *     description: See who will win and how much if admin declares this specific result (pana + phase). Returns paginated list of winners with payouts.
 *     tags: [Admin, Admin Results]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: phase
 *         required: true
 *         schema:
 *           type: string
 *           enum: [OPEN_RUNNING, CLOSE_RUNNING]
 *       - in: path
 *         name: pana
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{3}$'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Winners preview generated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           betId:
 *                             type: string
 *                           userId:
 *                             type: string
 *                           username:
 *                             type: string
 *                           selection:
 *                             type: string
 *                           betAmount:
 *                             type: number
 *                           payout:
 *                             type: number
 *                           payoutInRupees:
 *                             type: string
 *                           betAmountInRupees:
 *                             type: string
 *       400:
 *         description: Invalid phase or pana
 *       404:
 *         description: Session not found
 */
router.get('/sessions/:sessionId/preview-winners/:phase/:pana', ...requireAdminAuth, userLimiter, previewWinnersForResult);

/**
 * Revert batch endpoints
 * POST   /admin/results/sessions/:sessionId/revert-batches  — create + queue async
 * GET    /admin/results/sessions/:sessionId/revert-batches  — list
 * GET    /admin/results/revert-batches/:batchId             — get status
 */
router.post('/sessions/:sessionId/revert-batches', ...requireAdminAuth, userLimiter, createAndExecuteRevertBatch);
router.get('/sessions/:sessionId/revert-batches', ...requireAdminAuth, listRevertBatches);
router.get('/revert-batches/:batchId', ...requireAdminAuth, getRevertBatchStatus);

/**
 * Bid history (admin read-only)
 * GET /admin/results/bid-history
 */
router.get('/bid-history', ...requireAdminAuth, listBidHistory);

/**
 * Clear & refund all (async)
 * POST /admin/results/sessions/:sessionId/revert-all
 */
router.post('/sessions/:sessionId/revert-all', ...requireAdminAuth, userLimiter, createAndEnqueueRevertAll);

module.exports = router;
