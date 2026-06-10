const mongoose = require('mongoose');
const { BET_MODE } = require('@config/constants/domain');

const numericMapField = {
  type: Map,
  of: Number,
  default: {},
};

const digitStatSchema = new mongoose.Schema(
  {
    digit: { type: Number, required: true },
    count: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

const buildDigitStatsTemplate = () =>
  Array.from({ length: 10 }, (_, digit) => ({
    digit,
    count: 0,
    amount: 0,
  }));

const sessionExposureSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GameSession',
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: Object.values(BET_MODE),
      required: true,
      index: true,
    },
    totalCollection: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalBets: {
      type: Number,
      default: 0,
      min: 0,
    },
    digitStats: {
      type: [digitStatSchema],
      default: buildDigitStatsTemplate,
    },
    singleExposure: numericMapField,
    jodiExposure: numericMapField,
    panaExposure: numericMapField,
    compositeExposure: numericMapField,
    gameTypeStats: {
      type: Map,
      of: new mongoose.Schema(
        {
          count: { type: Number, default: 0 },
          amount: { type: Number, default: 0 },
        },
        { _id: false },
      ),
      default: {},
    },
  },
  { timestamps: true },
);

sessionExposureSchema.index({ sessionId: 1, mode: 1 }, { unique: true });

module.exports = mongoose.model('SessionExposure', sessionExposureSchema);
