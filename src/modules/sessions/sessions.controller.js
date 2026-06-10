/**
 * Game Session Controller
 * Handles game session management endpoints (create, list, lock, etc.)
 */

const gameSessionService = require('./sessions.service');
const { sendSuccess } = require('@utils/response');
const asyncHandler = require('@utils/asyncHandler');
const { validateCancelSessionPayload } = require('./sessions.validator');

/**
 * POST /sessions/create-daily
 * Create daily sessions for all active markets
 * ADMIN ONLY
 */
const createDailySessions = asyncHandler(async (req, res) => {
  const result = gameSessionService.startDailySessionCreationInBackground();

  sendSuccess(
    res,
    {
      started: result.started,
      message: result.message,
      statusUrl: result.statusUrl,
    },
    result.message,
    result.started ? 202 : 200,
  );
});

const getDailySessionCreationStatus = asyncHandler(async (_req, res) => {
  const status = gameSessionService.getDailySessionCreationStatus();
  sendSuccess(res, status, 'Daily session creation status');
});

/**
 * GET /sessions
 * Get all sessions for today with market details
 * ADMIN/USER
 */
const getAllSessions = asyncHandler(async (req, res) => {
  const sessionsWithMarket = await gameSessionService.getTodaysSessionsWithMarket();
  if (!sessionsWithMarket.length) {
    return sendSuccess(res, [], 'No sessions found for today');
  }
  sendSuccess(res, sessionsWithMarket, 'Sessions retrieved successfully');
});

/**
 * GET /sessions/market/:marketId
 * Get active session for a specific market
 * PUBLIC
 */
const getActiveSessionForMarket = asyncHandler(async (req, res) => {
  const { marketId } = req.params;
  const session = await gameSessionService.getActiveSessionForMarketDetails(marketId);
  sendSuccess(res, session, 'Active session retrieved');
});

/**
 * GET /sessions/:sessionId
 * Get detailed session information
 * PUBLIC
 */
const getSessionById = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await gameSessionService.getSessionDetailsById(sessionId);
  sendSuccess(res, session, 'Session details retrieved');
});

/**
 * POST /sessions/:sessionId/lock
 * Lock session (transition from open to close phase)
 * ADMIN ONLY / SYSTEM
 */
const lockSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const result = await gameSessionService.lockSessionWithDetails(sessionId);

  sendSuccess(res, result, 'Session locked successfully');
});

const cancelSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const payload = validateCancelSessionPayload(req.body);
  const result = await gameSessionService.cancelSession({
    sessionId,
    ...payload,
    adminUserId: req.user.id,
  });

  sendSuccess(res, result, 'Session cancelled successfully');
});

/**
 * GET /sessions/status/summary
 * Get market status summary for all sessions today
 * ADMIN/USER
 */
const getMarketStatusSummary = asyncHandler(async (req, res) => {
  const summary = await gameSessionService.getMarketStatusSummary();

  sendSuccess(
    res,
    {
      date: new Date().toISOString().split('T')[0],
      summary: {
        total: summary.total,
        openPhase: summary.openPhase,
        closePhase: summary.closePhase,
        settled: summary.settled,
      },
      markets: summary.markets,
    },
    'Market status summary retrieved',
  );
});

/**
 * GET /sessions/date/:date
 * Get sessions for a specific date (YYYY-MM-DD)
 * ADMIN ONLY
 */
const getSessionsByDate = asyncHandler(async (req, res) => {
  const { date } = req.params;
  const sessionsWithMarket = await gameSessionService.getSessionsByDateWithMarket(date);
  if (!sessionsWithMarket.length) {
    return sendSuccess(res, [], `No sessions found for ${date}`);
  }
  sendSuccess(res, sessionsWithMarket, `Sessions for ${date} retrieved successfully`);
});

/**
 * GET /admin/sessions
 * Get all sessions for today (or date) with full admin snapshot
 * ADMIN ONLY
 */
const getAdminSessionsOverview = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const sessions = await gameSessionService.getAdminSessionsOverview(date || null);
  sendSuccess(res, sessions, date ? `Sessions overview for ${date}` : 'Today sessions overview');
});

module.exports = {
  createDailySessions,
  getDailySessionCreationStatus,
  getAllSessions,
  getActiveSessionForMarket,
  getSessionById,
  lockSession,
  cancelSession,
  getMarketStatusSummary,
  getSessionsByDate,
  getAdminSessionsOverview,
};

