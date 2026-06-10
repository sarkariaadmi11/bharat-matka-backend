/**
 * Task Handlers Initialization
 * Registers all EventTask handlers at application startup.
 */

const { RepositoryFactory } = require('@infra/database');
const EventTaskRegistry = require('./eventTaskRegistry');
const eventTaskTypes = require('@config/constants/eventTaskTypes');
const { BET_MODE, SESSION_PHASE } = require('@config/constants/domain');
const { settleResult } = require('../../modules/results/engine/SettlementOrchestrator');
const logger = require('@utils/logger');

const gameSessionRepo = RepositoryFactory.getRepository('GameSession');

const initializeTaskHandlers = () => {
  EventTaskRegistry.registerTaskHandler(
    eventTaskTypes.MARKET_LOCK,
    async (payload) => {
      const { sessionId, marketName } = payload;

      if (!sessionId) {
        throw new Error('Session ID required for MARKET_LOCK');
      }

      const lockedSession = await gameSessionRepo.lockSession(sessionId);
      if (!lockedSession) {
        logger.info({
          message: 'session.lock_skipped',
          sessionId: String(sessionId),
          marketName: marketName || null,
        });
        return;
      }

      logger.info({
        message: 'session.phase_changed',
        sessionId: String(sessionId),
        marketName: marketName || null,
        toPhase: SESSION_PHASE.MARKET_CLOSED,
      });
    },
    'Lock market session at close time',
  );

  EventTaskRegistry.registerTaskHandler(
    eventTaskTypes.MARKET_PHASE_CHANGE,
    async (payload) => {
      const { sessionId, marketName } = payload;

      if (!sessionId) {
        throw new Error('Session ID required for MARKET_PHASE_CHANGE');
      }

      const updatedSession = await gameSessionRepo.setPhase(sessionId, SESSION_PHASE.CLOSE_RUNNING);
      if (!updatedSession) {
        logger.info({
          message: 'session.phase_change_skipped',
          sessionId: String(sessionId),
          marketName: marketName || null,
        });
        return;
      }

      logger.info({
        message: 'session.phase_changed',
        sessionId: String(sessionId),
        marketName: marketName || null,
        toPhase: SESSION_PHASE.CLOSE_RUNNING,
      });
    },
    'Transition session to close-running at openTime',
  );

  EventTaskRegistry.registerTaskHandler(
    eventTaskTypes.SETTLE_OPEN_RESULT,
    async (payload) => {
      const {
        sessionId,
        betMode = BET_MODE.OPEN,
        settlementJobId,
        resultRevision,
      } = payload;

      if (!sessionId) {
        throw new Error('Session ID required for SETTLE_OPEN_RESULT');
      }

      await settleResult({ sessionId, betMode, settlementJobId, resultRevision });
    },
    'Settle open phase bets with result',
  );

  EventTaskRegistry.registerTaskHandler(
    eventTaskTypes.SETTLE_CLOSE_RESULT,
    async (payload) => {
      const {
        sessionId,
        betMode = BET_MODE.CLOSE,
        settlementJobId,
        resultRevision,
      } = payload;

      if (!sessionId) {
        throw new Error('Session ID required for SETTLE_CLOSE_RESULT');
      }

      await settleResult({ sessionId, betMode, settlementJobId, resultRevision });
    },
    'Settle close phase bets with result (final)',
  );

  EventTaskRegistry.registerTaskHandler(
    eventTaskTypes.PROCESS_REVERT_BATCH,
    async (payload) => {
      const { batchId } = payload;

      if (!batchId) {
        throw new Error('batchId required for PROCESS_REVERT_BATCH');
      }

      const { executeRevertBatch } = require('../../modules/admin/results/revertBatch.service');
      await executeRevertBatch(batchId);
    },
    'Process a revert batch asynchronously',
  );

  logger.info({
    message: 'task.handlers_ready',
  });
};

module.exports = {
  initializeTaskHandlers,
};

