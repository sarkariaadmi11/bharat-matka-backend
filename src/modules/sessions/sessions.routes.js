/**
 * Game Session Routes
 * Handles all session management endpoints
 */

const express = require('express');
const router = express.Router();

const {
  createDailySessions,
  getDailySessionCreationStatus,
  getAllSessions,
  getActiveSessionForMarket,
  getSessionById,
  lockSession,
  getMarketStatusSummary,
  getSessionsByDate,
  getAdminSessionsOverview,
} = require('./sessions.controller');

const { requireAuth, requireAdmin } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');

// ============================================
// Swagger Documentation
// ============================================

/**
 * @swagger
 * tags:
 *   name: GameSessions
 *   description: Game session management (create, lock, view status)
 */

/**
 * @swagger
 * /sessions/create-daily:
 *   get:
 *     summary: Create daily sessions for all active markets
 *     description: |
 *       Creates a new gaming session for each active market for today.
 *       Automatically schedules MARKET_LOCK tasks at close times.
 *       Call this endpoint once daily via cron or manually.
 *     tags: [GameSessions]
 *     responses:
 *       201:
 *         description: Daily sessions created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     created:
 *                       type: integer
 *                       description: Number of sessions created
 *                     skipped:
 *                       type: integer
 *                       description: Number of duplicate sessions skipped
 *                     errors:
 *                       type: array
 *                       description: Any errors encountered
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.get('/create-daily', createDailySessions);

/**
 * @swagger
 * /sessions/create-daily/status:
 *   get:
 *     summary: Get background daily-session creation job status
 *     description: |
 *       Returns current status of the background daily-session creation process.
 *       Useful after triggering /sessions/create-daily, which runs asynchronously.
 *     tags: [GameSessions]
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     running:
 *                       type: boolean
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     finishedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     result:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         created:
 *                           type: integer
 *                         skipped:
 *                           type: integer
 *                         errors:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               marketId:
 *                                 type: string
 *                                 nullable: true
 *                               marketName:
 *                                 type: string
 *                                 nullable: true
 *                               error:
 *                                 type: string
 *                     error:
 *                       type: string
 *                       nullable: true
 *                 message:
 *                   type: string
 */
router.get('/create-daily/status', getDailySessionCreationStatus);

/**
 * @swagger
 * /sessions/public:
 *   get:
 *     summary: Get sessions by date (public, no auth required)
 *     description: |
 *       Returns sessions for a given date (YYYY-MM-DD) with market details.
 *       No authentication required. Mirrors /admin/sessions behavior.
 *     tags: [GameSessions]
 *     parameters:
 *       - in: query
 *         name: date
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-05-24"
 *     responses:
 *       200:
 *         description: Sessions for the specified date
 */
router.get('/public', getAdminSessionsOverview);

/**
 * @swagger
 * /sessions:
 *   get:
 *     summary: Get all sessions for today
 *     description: |
 *       Retrieves all game sessions for today with market details.
 *       Shows phase (open_running/close_running/market_closed/settled) and timing information.
 *     tags: [GameSessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of today's sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GameSession'
 *                 message:
 *                   type: string
 */
router.get('/', requireAuth, userLimiter, getAllSessions);

/**
 * @swagger
 * /sessions/status/summary:
 *   get:
 *     summary: Get market status summary for today
 *     description: |
 *       Returns a summary of all markets showing:
 *       - Count by phase (open_running, close_running, market_closed, settled)
 *       - Individual market statuses
 *       - Current phase and timing
 *     tags: [GameSessions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Market status summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         openPhase:
 *                           type: integer
 *                         closePhase:
 *                           type: integer
 *                         settled:
 *                           type: integer
 *                     markets:
 *                       type: array
 */
router.get('/status/summary', requireAuth, userLimiter, getMarketStatusSummary);

/**
 * @swagger
 * /sessions/date/{date}:
 *   get:
 *     summary: Get sessions for a specific date
 *     description: |
 *       Retrieves game sessions for a given date.
 *       Date format must be YYYY-MM-DD.
 *     tags: [GameSessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-01-19"
 *     responses:
 *       200:
 *         description: Sessions for the specified date
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *       400:
 *         description: Invalid date format
 */
router.get('/date/:date', requireAuth, userLimiter, requireAdmin, getSessionsByDate);

/**
 * @swagger
 * /sessions/market/{marketId}:
 *   get:
 *     summary: Get active session for a market
 *     description: |
 *       Retrieves the currently active (betting-eligible) session for a market.
 *       Returns null if no active session exists.
 *     tags: [GameSessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: marketId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *     responses:
 *       200:
 *         description: Active session for market
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameSession'
 *       400:
 *         description: Invalid market ID
 *       404:
 *         description: No active session for market
 */
router.get('/market/:marketId', requireAuth, userLimiter, getActiveSessionForMarket);

/**
 * @swagger
 * /sessions/{sessionId}:
 *   get:
 *     summary: Get session details
 *     description: |
 *       Retrieves detailed information about a specific session including
 *       phase, timing, and current results (if available).
 *     tags: [GameSessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *     responses:
 *       200:
 *         description: Session details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameSession'
 *       400:
 *         description: Invalid session ID
 *       404:
 *         description: Session not found
 */
router.get('/:sessionId', requireAuth, userLimiter, getSessionById);

/**
 * @swagger
 * /sessions/{sessionId}/lock:
 *   post:
 *     summary: Lock session (transition to close phase)
 *     description: |
 *       Locks a session, transitioning it to 'market_closed' phase.
 *       No more betting allowed (OPEN and CLOSE bets disabled).
 *       Typically called automatically when close time arrives (e.g., 8:00 PM).
 *     tags: [GameSessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *     responses:
 *       200:
 *         description: Session locked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                     marketName:
 *                       type: string
 *                     phase:
 *                       type: string
 *                       enum: [open_running, close_running, market_closed, settled]
 *       400:
 *         description: Invalid session ID or cannot lock
 *       403:
 *         description: Admin/system access required
 *       404:
 *         description: Session not found
 */
router.post('/:sessionId/lock', requireAuth, userLimiter, requireAdmin, lockSession);

module.exports = router;

