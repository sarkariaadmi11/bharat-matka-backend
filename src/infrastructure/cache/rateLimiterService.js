const { setInterval } = require('timers');

const RateLimiterService = class RateLimiterService {
  constructor() {
    this.store = new Map();
    const config = require('@config/rateLimiterConfig');
    const cleanupIntervalMs = Math.max(
      10 * 1000,
      Number(config.cleanupIntervalMs) || 5 * 60 * 1000,
    );
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);
    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  _makeKey(type, id, action) {
    return `${type}:${id}${action ? `:${action}` : ''}`;
  }

  increment(type, id, windowMs, max, action) {
    const key = this._makeKey(type, id, action);
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || now >= entry.expiresAt) {
      entry = { count: 0, expiresAt: now + windowMs };
    }

    entry.count += 1;
    this.store.set(key, entry);

    const allowed = entry.count <= max;
    const remaining = allowed ? max - entry.count : 0;
    const reset = Math.ceil((entry.expiresAt - now) / 1000);

    return { allowed, remaining, limit: max, reset };
  }

  cleanup() {
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (v.expiresAt <= now) {
        this.store.delete(k);
      }
    }
  }
};

module.exports = {
  RateLimiterService,
  rateLimiterService: new RateLimiterService(),
};

