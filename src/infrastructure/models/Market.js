const mongoose = require('mongoose');
const { MARKET_STATUS } = require('@config/constants/domain');

const WEEKDAY_KEYS = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const ACTIVE_INACTIVE_STATUSES = Object.freeze([
  MARKET_STATUS.ACTIVE,
  MARKET_STATUS.INACTIVE,
]);

const weeklyScheduleSchema = new mongoose.Schema(
  WEEKDAY_KEYS.reduce((shape, weekday) => {
    shape[weekday] = { type: Boolean, default: false, required: true };
    return shape;
  }, {}),
  { _id: false },
);

const marketGameTypeSchema = new mongoose.Schema(
  {
    gameTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameType',
      required: true,
    },
    status: { type: String, enum: ACTIVE_INACTIVE_STATUSES, default: MARKET_STATUS.ACTIVE },
    payoutMultiplier: { type: Number },
    minBet: { type: Number },
    maxBet: { type: Number },
  },
  { _id: false },
);

const marketSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    openTime: { type: String, required: true },
    closeTime: { type: String, required: true },
    gameTypes: { type: [marketGameTypeSchema], default: [] },
    schedule: { type: weeklyScheduleSchema, required: true },
    status: { type: String, enum: ACTIVE_INACTIVE_STATUSES, default: MARKET_STATUS.ACTIVE, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

marketSchema.index({ status: 1, code: 1 });

module.exports = mongoose.model('Market', marketSchema);
