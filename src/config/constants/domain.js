const SESSION_PHASE = Object.freeze({
  OPEN_RUNNING: 'open_running',
  CLOSE_RUNNING: 'close_running',
  MARKET_CLOSED: 'market_closed',
  SETTLED: 'settled',
});

const SESSION_STATUS = Object.freeze({
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  SETTLED: 'settled',
});

const SESSION_PHASE_ALIAS = Object.freeze({
  OPEN: 'open',
  CLOSE: 'close',
});

const BET_MODE = Object.freeze({
  OPEN: 'open',
  CLOSE: 'close',
});

const BET_STATUS = Object.freeze({
  PENDING: 'pending',
  WON: 'won',
  LOST: 'lost',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
});

const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  BANNED: 'banned',
});

const MARKET_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

const GAME_TYPE_PHASE = Object.freeze({
  OPEN_ONLY: 'open_only',
  CLOSE_ONLY: 'close_only',
  BOTH: 'both',
});

const EVENT_TASK_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

const SETTLEMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

/**
 * Status lifecycle for persisted RevertBatch documents.
 * pending → processing → completed | failed
 * A 'failed' batch is still resumable via lastProcessedCursor.
 */
const REVERT_BATCH_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

const NOTIFICATION_EVENT = Object.freeze({
  RESULT_DECLARED: 'RESULT_DECLARED',
});

const TRANSACTION_TYPE = Object.freeze({
  BET_DEBIT: 'BET_DEBIT',
  WIN_CREDIT: 'WIN_CREDIT',
  ADMIN_ADJUSTMENT: 'ADMIN_ADJUSTMENT',
  REFUND: 'REFUND',
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL_DEBIT: 'WITHDRAWAL_DEBIT',
  WITHDRAWAL_REVERSAL: 'WITHDRAWAL_REVERSAL',
});

const TRANSACTION_SOURCE = Object.freeze({
  ADMIN: 'admin',
  BET: 'bet',
  SYSTEM: 'system',
});

const TRANSACTION_REFERENCE_TYPE = Object.freeze({
  BET: 'BET',
  PAYMENT: 'PAYMENT',
  PAYOUT: 'PAYOUT',
  ADMIN: 'ADMIN',
  REFUND: 'REFUND',
  SETTLEMENT: 'SETTLEMENT',
  OTHER: 'OTHER',
});

module.exports = {
  SESSION_PHASE,
  SESSION_STATUS,
  SESSION_PHASE_ALIAS,
  BET_MODE,
  BET_STATUS,
  USER_STATUS,
  MARKET_STATUS,
  GAME_TYPE_PHASE,
  EVENT_TASK_STATUS,
  SETTLEMENT_STATUS,
  REVERT_BATCH_STATUS,
  NOTIFICATION_EVENT,
  TRANSACTION_TYPE,
  TRANSACTION_SOURCE,
  TRANSACTION_REFERENCE_TYPE,
};
