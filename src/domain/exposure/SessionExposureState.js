class SessionExposureState {
  constructor({
    sessionId = null,
    mode = null,
    totalCollection = 0,
    totalBets = 0,
    digitStats = [],
    singleExposure = {},
    jodiExposure = {},
    panaExposure = {},
    compositeExposure = {},
    gameTypeStats = {},
  } = {}) {
    this.sessionId = sessionId;
    this.mode = mode;
    this.totalCollection = Number(totalCollection || 0);
    this.totalBets = totalBets === null || totalBets === undefined
      ? null
      : Number(totalBets || 0);
    this.digitStats = SessionExposureState.normalizeDigitStats(digitStats);
    this.singleExposure = SessionExposureState.normalizeMap(singleExposure);
    this.jodiExposure = SessionExposureState.normalizeMap(jodiExposure);
    this.panaExposure = SessionExposureState.normalizeMap(panaExposure);
    this.compositeExposure = SessionExposureState.normalizeMap(compositeExposure);
    this.gameTypeStats = SessionExposureState.normalizeGameTypeStats(gameTypeStats);
  }

  static buildDigitStatsTemplate() {
    return Array.from({ length: 10 }, (_, digit) => ({
      digit,
      count: 0,
      amount: 0,
    }));
  }

  static normalizeMap(value = {}) {
    if (value instanceof Map) {
      return Object.fromEntries(value.entries());
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const normalized = {};
    for (const [key, amount] of Object.entries(value)) {
      const parsed = Number(amount || 0);
      if (!Number.isFinite(parsed) || parsed === 0) {
        continue;
      }
      normalized[String(key)] = parsed;
    }
    return normalized;
  }

  static normalizeDigitStats(value = []) {
    if (value === null || value === undefined) {
      return null;
    }
    const template = SessionExposureState.buildDigitStatsTemplate();
    if (!Array.isArray(value)) {
      return template;
    }

    for (const item of value) {
      const digit = Number(item?.digit);
      if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        continue;
      }
      template[digit].count += Number(item?.count || 0);
      template[digit].amount += Number(item?.amount || 0);
    }

    return template;
  }

  static normalizeGameTypeStats(value = {}) {
    if (value instanceof Map) {
      return SessionExposureState.normalizeGameTypeStats(Object.fromEntries(value.entries()));
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const normalized = {};
    for (const [key, stats] of Object.entries(value)) {
      const count = Number(stats?.count || 0);
      const amount = Number(stats?.amount || 0);
      if (!Number.isFinite(count) && !Number.isFinite(amount)) {
        continue;
      }
      normalized[String(key)] = {
        count: Number.isFinite(count) ? count : 0,
        amount: Number.isFinite(amount) ? amount : 0,
      };
    }
    return normalized;
  }

  static fromDocument(document = null) {
    if (!document) {
      return null;
    }

    return new SessionExposureState({
      sessionId: document.sessionId,
      mode: document.mode,
      totalCollection: document.totalCollection,
      totalBets: document.totalBets,
      digitStats: document.digitStats,
      singleExposure: document.singleExposure,
      jodiExposure: document.jodiExposure,
      panaExposure: document.panaExposure,
      compositeExposure: document.compositeExposure,
      gameTypeStats: document.gameTypeStats,
    });
  }

  static empty({ sessionId = null, mode = null } = {}) {
    return new SessionExposureState({ sessionId, mode });
  }

  applyDelta(delta = {}) {
    this.totalCollection += Number(delta.totalCollection || 0);
    if (delta.totalBets !== null && delta.totalBets !== undefined) {
      this.totalBets = Number(this.totalBets || 0) + Number(delta.totalBets || 0);
    }
    this.digitStats = SessionExposureState.mergeDigitStats(this.digitStats, delta.digitStats);
    this.singleExposure = SessionExposureState.mergeMaps(this.singleExposure, delta.singleExposure);
    this.jodiExposure = SessionExposureState.mergeMaps(this.jodiExposure, delta.jodiExposure);
    this.panaExposure = SessionExposureState.mergeMaps(this.panaExposure, delta.panaExposure);
    this.compositeExposure = SessionExposureState.mergeMaps(this.compositeExposure, delta.compositeExposure);
    this.gameTypeStats = SessionExposureState.mergeGameTypeStats(this.gameTypeStats, delta.gameTypeStats);
    return this;
  }

  static mergeDigitStats(base = [], delta = []) {
    const next = SessionExposureState.normalizeDigitStats(base);
    const normalizedDelta = SessionExposureState.normalizeDigitStats(delta);
    if (!next && !normalizedDelta) {
      return null;
    }
    if (!next) {
      return normalizedDelta;
    }
    if (!normalizedDelta) {
      return next;
    }
    for (const item of normalizedDelta) {
      const digit = Number(item.digit);
      if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
        continue;
      }
      next[digit].count += Number(item.count || 0);
      next[digit].amount += Number(item.amount || 0);
    }
    return next;
  }

  static mergeGameTypeStats(base = {}, delta = {}) {
    const next = { ...SessionExposureState.normalizeGameTypeStats(base) };
    const normalizedDelta = SessionExposureState.normalizeGameTypeStats(delta);

    for (const [key, stats] of Object.entries(normalizedDelta)) {
      if (!next[key]) {
        next[key] = { count: 0, amount: 0 };
      }
      next[key].count += Number(stats.count || 0);
      next[key].amount += Number(stats.amount || 0);
    }

    return next;
  }

  static mergeMaps(base = {}, delta = {}) {
    const next = { ...SessionExposureState.normalizeMap(base) };
    const normalizedDelta = SessionExposureState.normalizeMap(delta);

    for (const [key, value] of Object.entries(normalizedDelta)) {
      const current = Number(next[key] || 0);
      const updated = current + value;
      if (!updated) {
        delete next[key];
        continue;
      }
      next[key] = updated;
    }

    return next;
  }

  toPlainObject() {
    return {
      sessionId: this.sessionId,
      mode: this.mode,
      totalCollection: this.totalCollection,
      totalBets: this.totalBets,
      digitStats: this.digitStats ? this.digitStats.map((stat) => ({ ...stat })) : null,
      singleExposure: { ...this.singleExposure },
      jodiExposure: { ...this.jodiExposure },
      panaExposure: { ...this.panaExposure },
      compositeExposure: { ...this.compositeExposure },
      gameTypeStats: { ...this.gameTypeStats },
    };
  }
}

module.exports = SessionExposureState;
