const BaseRepository = require('./baseRepository');
const { SessionExposure } = require('@infra/models');
const mongoose = require('mongoose');

const appendIncPaths = (target, prefix, source = {}) => {
  for (const [key, value] of Object.entries(source || {})) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed === 0) {
      continue;
    }
    target[`${prefix}.${key}`] = parsed;
  }
};

const appendDigitStatInc = (target, setTarget, digitStats = []) => {
  if (!Array.isArray(digitStats)) {
    return;
  }
  for (const stat of digitStats) {
    const digit = Number(stat?.digit);
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
      continue;
    }
    const count = Number(stat?.count || 0);
    const amount = Number(stat?.amount || 0);
    if (Number.isFinite(count) && count !== 0) {
      target[`digitStats.${digit}.count`] = (target[`digitStats.${digit}.count`] || 0) + count;
    }
    if (Number.isFinite(amount) && amount !== 0) {
      target[`digitStats.${digit}.amount`] = (target[`digitStats.${digit}.amount`] || 0) + amount;
    }
    setTarget[`digitStats.${digit}.digit`] = digit;
  }
};

const appendGameTypeStatsInc = (target, source = {}) => {
  for (const [key, stats] of Object.entries(source || {})) {
    const safeKey = String(key).replace(/\./g, '_');
    const count = Number(stats?.count || 0);
    const amount = Number(stats?.amount || 0);
    if (Number.isFinite(count) && count !== 0) {
      target[`gameTypeStats.${safeKey}.count`] = (target[`gameTypeStats.${safeKey}.count`] || 0) + count;
    }
    if (Number.isFinite(amount) && amount !== 0) {
      target[`gameTypeStats.${safeKey}.amount`] = (target[`gameTypeStats.${safeKey}.amount`] || 0) + amount;
    }
  }
};

class SessionExposureRepository extends BaseRepository {
  constructor() {
    super(SessionExposure);
  }

  normalizeSessionId(sessionId) {
    if (typeof sessionId === 'string' && mongoose.Types.ObjectId.isValid(sessionId)) {
      return new mongoose.Types.ObjectId(sessionId);
    }
    return sessionId;
  }

  async findBySessionAndMode(sessionId, mode) {
    return this.model.findOne({
      sessionId: this.normalizeSessionId(sessionId),
      mode,
    }).lean();
  }

  async applyDelta({ sessionId, mode, delta = {}, session = null }) {
    const inc = {
      totalCollection: Number(delta.totalCollection || 0),
      totalBets: Number(delta.totalBets || 0),
    };
    const set = {};

    appendIncPaths(inc, 'singleExposure', delta.singleExposure);
    appendIncPaths(inc, 'jodiExposure', delta.jodiExposure);
    appendIncPaths(inc, 'panaExposure', delta.panaExposure);
    appendIncPaths(inc, 'compositeExposure', delta.compositeExposure);
    appendDigitStatInc(inc, set, delta.digitStats);
    appendGameTypeStatsInc(inc, delta.gameTypeStats);

    const update = {
      $setOnInsert: {
        sessionId: this.normalizeSessionId(sessionId),
        mode,
      },
      ...(Object.keys(set).length ? { $set: set } : {}),
      $inc: inc,
      $currentDate: { updatedAt: true },
    };

    return this.model.findOneAndUpdate(
      {
        sessionId: this.normalizeSessionId(sessionId),
        mode,
      },
      update,
      {
        new: true,
        upsert: true,
        session,
      },
    );
  }
}

module.exports = SessionExposureRepository;
