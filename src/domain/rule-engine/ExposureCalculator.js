const { canonicalizePana } = require('@utils/panaCanonicalization');

class ExposureCalculator {
  static emptyDigitStats() {
    return Array.from({ length: 10 }, (_, digit) => ({
      digit: String(digit),
      betCount: 0,
      totalAmount: 0,
      potentialPayout: 0,
    }));
  }

  static calculate(bets = []) {
    const digitExposureMap = new Map();
    const panaExposureMap = new Map();
    const digitStats = ExposureCalculator.emptyDigitStats();

    let totalCollection = 0;

    for (const bet of bets) {
      const selection = String(bet?.selection || '');
      const amount = Number(bet?.amount || 0);
      const potentialPayout = amount * Number(bet?.oddsSnapshot || 0);

      totalCollection += amount;

      if (/^\d$/.test(selection)) {
        digitExposureMap.set(selection, (digitExposureMap.get(selection) || 0) + potentialPayout);
        const stat = digitStats[Number(selection)];
        stat.betCount += 1;
        stat.totalAmount += amount;
        stat.potentialPayout += potentialPayout;
        continue;
      }

      if (/^\d{3}$/.test(selection)) {
        const panaKey = canonicalizePana(selection);
        panaExposureMap.set(panaKey, (panaExposureMap.get(panaKey) || 0) + potentialPayout);
      }
    }

    return {
      totalCollection,
      totalBets: bets.length,
      digitExposureMap,
      panaExposureMap,
      digitStats,
    };
  }

  static calculateFromSummary(summary = {}) {
    const digitExposureMap = new Map();
    const panaExposureMap = new Map();
    const digitStats = ExposureCalculator.emptyDigitStats();

    const rows = Array.isArray(summary.bySelection) ? summary.bySelection : [];

    for (const row of rows) {
      const selection = String(row?._id || '');
      const totalAmount = Number(row?.totalAmount || 0);
      const totalPotentialPayout = Number(row?.totalPotentialPayout || 0);
      const betCount = Number(row?.betCount || 0);

      if (/^\d$/.test(selection)) {
        digitExposureMap.set(selection, totalPotentialPayout);
        const stat = digitStats[Number(selection)];
        stat.betCount += betCount;
        stat.totalAmount += totalAmount;
        stat.potentialPayout += totalPotentialPayout;
        continue;
      }

      if (/^\d{3}$/.test(selection)) {
        const panaKey = canonicalizePana(selection);
        panaExposureMap.set(panaKey, (panaExposureMap.get(panaKey) || 0) + totalPotentialPayout);
      }
    }

    return {
      totalCollection: Number(summary?.totals?.totalCollection || 0),
      totalBets: Number(summary?.totals?.totalBets || 0),
      digitExposureMap,
      panaExposureMap,
      digitStats,
    };
  }
}

module.exports = ExposureCalculator;
