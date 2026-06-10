const { BET_MODE } = require('@config/constants/domain');
const { resolveMotorLineStakePaise } = require('@modules/bets/betProjection.service');
const ExposureKeyRegistry = require('./ExposureKeyRegistry');

const buildModeDelta = () => ({
  totalCollection: 0,
  singleExposure: {},
  jodiExposure: {},
  panaExposure: {},
  compositeExposure: {},
});

const mergeExposureMap = (target, source = {}) => {
  for (const [key, value] of Object.entries(source || {})) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed === 0) {
      continue;
    }
    target[key] = Number(target[key] || 0) + parsed;
  }
};

const mergeDelta = (target, delta = {}) => {
  target.totalCollection += Number(delta.totalCollection || 0);
  mergeExposureMap(target.singleExposure, delta.singleExposure);
  mergeExposureMap(target.jodiExposure, delta.jodiExposure);
  mergeExposureMap(target.panaExposure, delta.panaExposure);
  mergeExposureMap(target.compositeExposure, delta.compositeExposure);
};

const applyMotorDelta = ({ delta, bet }) => {
  const combinations = Array.isArray(bet.generatedPanas) ? bet.generatedPanas : [];
  if (!combinations.length) {
    return;
  }

  for (const pana of combinations) {
    const lineStake = resolveMotorLineStakePaise(bet, pana);
    const linePotentialPayout = lineStake * Number(bet.oddsSnapshot || 0);
    delta.panaExposure[pana] = Number(delta.panaExposure[pana] || 0) + linePotentialPayout;
  }
};

class ExposureDeltaGenerator {
  static buildModeDelta() {
    return buildModeDelta();
  }

  static generateFromBet(bet = {}) {
    const amount = Number(bet.amount || 0);
    const odds = Number(bet.oddsSnapshot || 0);
    const potentialPayout = amount * odds;
    const betMode = bet.betMode || BET_MODE.OPEN;

    const resolver = ExposureKeyRegistry.resolveByBet(bet);
    if (!resolver) {
      return null;
    }

    const result = resolver({
      selection: bet.selection,
      amount,
      potentialPayout,
      betMode,
      bet,
    });

    if (!result || !result.mode) {
      return null;
    }

    const delta = buildModeDelta();
    delta.totalCollection = amount;
    mergeDelta(delta, result.delta);
    if (result.motorType) {
      applyMotorDelta({
        delta,
        bet,
      });
    }

    return {
      mode: result.mode,
      delta,
    };
  }

  static generateGroupedDeltas(bets = []) {
    const grouped = {
      [BET_MODE.OPEN]: buildModeDelta(),
      [BET_MODE.CLOSE]: buildModeDelta(),
    };

    for (const bet of bets) {
      const mapped = ExposureDeltaGenerator.generateFromBet(bet);
      if (!mapped) {
        continue;
      }
      mergeDelta(grouped[mapped.mode], mapped.delta);
    }

    return grouped;
  }
}

module.exports = ExposureDeltaGenerator;
