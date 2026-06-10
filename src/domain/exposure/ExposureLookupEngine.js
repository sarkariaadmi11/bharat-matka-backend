const { BET_MODE } = require('@config/constants/domain');
const ExposureKeyRegistry = require('./ExposureKeyRegistry');
const { buildCanonicalPanaOutcomes } = require('@utils/panaCanonicalization');

const ALL_PANA_OUTCOMES = buildCanonicalPanaOutcomes();

const getValue = (map = {}, key) => Number(map?.[key] || 0);

class ExposureLookupEngine {
  static computeOutcomePayout({ state, candidate, mode, context = {} }) {
    const digitKey = String(candidate.outcomeDigit);
    let payout = 0;

    payout += getValue(state.singleExposure, digitKey);
    payout += getValue(state.panaExposure, candidate.outcomePana);

    if (mode === BET_MODE.CLOSE) {
      const openDigit = context.openDigit === null || context.openDigit === undefined
        ? null
        : String(context.openDigit);
      if (openDigit !== null) {
        const jodiKey = `${openDigit}${digitKey}`;
        payout += getValue(state.jodiExposure, jodiKey);
      }

      const compositeKeys = ExposureKeyRegistry.getCandidateCompositeKeys({
        candidate,
        context,
        mode,
      });

      for (const key of compositeKeys) {
        payout += getValue(state.compositeExposure, key);
      }
    }

    return payout;
  }

  static simulate({ state, mode, context = {} }) {
    const totalCollection = Number(state?.totalCollection || 0);
    const totalBets = state?.totalBets === null || state?.totalBets === undefined
      ? null
      : Number(state.totalBets || 0);
    const digitStats = Array.isArray(state?.digitStats) ? state.digitStats : null;
    const outcomes = ALL_PANA_OUTCOMES.map((candidate) => {
      const totalPayout = ExposureLookupEngine.computeOutcomePayout({
        state,
        candidate,
        mode,
        context,
      });

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
  }
}

module.exports = {
  ExposureLookupEngine,
  ALL_PANA_OUTCOMES,
};
