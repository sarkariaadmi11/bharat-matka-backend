const mongoose = require('mongoose');
const {
  SESSION_PHASE,
  SESSION_STATUS,
  SETTLEMENT_STATUS,
  GAME_TYPE_PHASE,
  MARKET_STATUS,
} = require('@config/constants/domain');

const resultSchema = new mongoose.Schema({
  openPana: { type: String, default: null },
  closePana: { type: String, default: null },
  openDigit: { type: Number, default: null },
  closeDigit: { type: Number, default: null },
  // Track when results are declared
  openDeclaredAt: { type: Date, default: null },
  closeDeclaredAt: { type: Date, default: null },
}, { _id: false });

const warningSchema = new mongoose.Schema({
  code: { type: String, required: true },
  message: { type: String, required: true },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true,
  },
  actionRequired: { type: Boolean, required: true },
  recommendedAction: { type: String, default: null },
  referenceSessionId: { type: String, default: null },
}, { _id: false });

const cancellationRequestSchema = new mongoose.Schema({
  idempotencyKey: { type: String, required: true },
  payloadHash: { type: String, required: true },
  requestedAt: { type: Date, required: true },
}, { _id: false });

const gameTypeSnapshotSchema = new mongoose.Schema({
  gameTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameType',
    required: true,
  },
  code: { type: String, required: true },
  name: { type: String, required: true },
  betPhaseType: {
    type: String,
    enum: Object.values(GAME_TYPE_PHASE),
    default: GAME_TYPE_PHASE.BOTH,
  },
  payoutMultiplier: { type: Number, default: null },
  minBet: { type: Number, default: null },
  maxBet: { type: Number, default: null },
  status: { type: String, enum: [MARKET_STATUS.ACTIVE, MARKET_STATUS.INACTIVE], required: true },
}, { _id: false });

const gameSessionSchema = new mongoose.Schema(
  {
    marketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Market',
      required: true,
      index: true,
    },

    sessionDate: {
      type: Date,
      required: true,
      index: true,
    },

    openTime: {
      type: Date,
      required: true,
    },

    closeTime: {
      type: Date,
      required: true,
    },

    openTimeSnapshot: {
      type: String,
      default: null,
    },

    closeTimeSnapshot: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: Object.values(SESSION_STATUS),
      default: SESSION_STATUS.ACTIVE,
      required: true,
      index: true,
    },

    phase: {
      type: String,
      // New clearer phase names:
      // 'open_running'  -> initial betting window where open bets are allowed (open result not yet declared)
      // 'close_running' -> after scheduled open-phase transition; close bets are running
      // 'market_closed' -> market locked for the day (no bets)
      // 'settled'       -> final settlement completed
      enum: Object.values(SESSION_PHASE),
      required: true,
      index: true,
      // LIFECYCLE: 'open' (both bet types allowed) → 'close' (locked, awaiting settlement) → 'settled' (final)
      // 'open': session active, OPEN bets + CLOSE bets accepted (after open result declared)
      // 'close': no bets allowed, market locked, awaiting close result & settlement
      // 'settled': all results finalized, payouts executed, session complete
    },

    openResultDeclared: {
      type: Boolean,
      default: false,
      index: true,
      // Controls when CLOSE bets transition from disabled → enabled
      // false: Only OPEN bets allowed, OPEN result pending
      // true: OPEN result shown, CLOSE bets NOW allowed (phase still 'open')
    },

    result: {
      type: resultSchema,
      default: () => ({}),
    },

    currentResult: {
      type: resultSchema,
      default: () => ({}),
    },

    settledResult: {
      type: resultSchema,
      default: () => ({}),
    },

    resultRevision: {
      type: Number,
      default: 0,
      min: 0,
    },

    settledResultRevision: {
      type: Number,
      default: 0,
      min: 0,
    },

    settlementStatus: {
      type: String,
      enum: Object.values(SETTLEMENT_STATUS),
      default: null,
      index: true,
    },

    lastSettlementJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SettlementJob',
      default: null,
    },

    isFinanciallyConsistent: {
      type: Boolean,
      default: true,
    },

    financialInconsistencyReason: {
      type: String,
      default: null,
    },

    financialInconsistencyDetectedAt: {
      type: Date,
      default: null,
    },

    warning: {
      type: warningSchema,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    cancellationReason: {
      type: String,
      default: null,
    },

    lastCancellationRequest: {
      type: cancellationRequestSchema,
      default: null,
    },

    gameTypesSnapshot: {
      type: [gameTypeSnapshotSchema],
      default: [],
    },

    settledAt: {
      type: Date,
      default: null,
    },

    resultDeclarationAvailableTill: {
      type: Date,
      default: null,
      index: true,
      description: 'Calculated deadline for admin result entries (min of closeTime+grace, 5AM next day)',
    },
  },
  { timestamps: true },
);

// One session per market per day
gameSessionSchema.index(
  { marketId: 1, sessionDate: 1 },
  { unique: true },
);
gameSessionSchema.index({ marketId: 1, phase: 1, sessionDate: -1 });

module.exports = mongoose.model('GameSession', gameSessionSchema);
