module.exports = {
  ip: {
    windowMs: 60 * 1000, // 1 minute
    max: 120, // coarse requests per IP per minute
  },
  user: {
    windowMs: 60 * 1000,
    max: 60, // authenticated user requests per minute
  },
  action: {
    DEFAULT: { windowMs: 60 * 1000, max: 20 },
    PLACE_BET: { windowMs: 60 * 1000, max: 5 }, // strict for placing bets
  },
  cleanupIntervalMs: 5 * 60 * 1000, // background cleanup
};
