const buildDigitStatsTemplate = () => (
  Array.from({ length: 10 }, (_, digit) => ({
    digit,
    count: 0,
    amount: 0,
  }))
);

const normalizeGameTypeKey = (bet = {}) => {
  const key = bet.gameTypeCodeSnapshot
    || bet.gameTypeCode
    || bet.gameType
    || bet.gameTypeTemplateKey
    || 'UNKNOWN';
  return String(key).toUpperCase();
};

const buildExposureSnapshot = (bets = []) => {
  const digitStats = buildDigitStatsTemplate();
  const gameTypeStats = {};
  let totalBets = 0;

  for (const bet of bets) {
    totalBets += 1;

    const amount = Number(bet?.amount || 0);
    const selection = String(bet?.selection || '');

    if (/^\d$/.test(selection)) {
      const stat = digitStats[Number(selection)];
      if (stat) {
        stat.count += 1;
        stat.amount += amount;
      }
    }

    const gameTypeKey = normalizeGameTypeKey(bet);
    if (!gameTypeStats[gameTypeKey]) {
      gameTypeStats[gameTypeKey] = { count: 0, amount: 0 };
    }
    gameTypeStats[gameTypeKey].count += 1;
    gameTypeStats[gameTypeKey].amount += amount;
  }

  return {
    totalBets,
    digitStats,
    gameTypeStats,
  };
};

module.exports = {
  buildExposureSnapshot,
  buildDigitStatsTemplate,
};
