const { buildCanonicalPanaOutcomes } = require('@utils/panaCanonicalization');

const ALL_PANA_OUTCOMES = buildCanonicalPanaOutcomes();

const simulateOutcomes = ({
  totalCollection,
  totalBets,
  digitExposureMap,
  panaExposureMap,
  digitStats,
}) => {
  const outcomes = ALL_PANA_OUTCOMES.map((candidate) => {
    const digitKey = String(candidate.outcomeDigit);
    const totalPayout =
      (digitExposureMap.get(digitKey) || 0) + (panaExposureMap.get(candidate.outcomePana) || 0);

    return {
      outcomePana: candidate.outcomePana,
      outcomeDigit: candidate.outcomeDigit,
      totalCollection,
      totalPayout,
      netProfit: totalCollection - totalPayout,
    };
  });

  const topOutcomes = [...outcomes].sort((a, b) => b.netProfit - a.netProfit);
  const riskOutcomes = [...outcomes]
    .sort((a, b) => b.totalPayout - a.totalPayout)
    .slice(0, 5);

  return {
    totalScenarios: ALL_PANA_OUTCOMES.length,
    totalCollection,
    totalBets,
    digitStats,
    topOutcomes,
    riskOutcomes,
  };
};

module.exports = {
  simulateOutcomes,
};
