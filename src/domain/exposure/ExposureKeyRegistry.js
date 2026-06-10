const { TEMPLATE } = require('@domain/rule-engine/GameTypeRegistry');
const { BET_MODE } = require('@config/constants/domain');
const {
  canonicalizePana,
  canonicalizePanaSelection,
} = require('@utils/panaCanonicalization');

const normalizeSelection = (selection) => canonicalizePanaSelection(selection);
const normalizeCode = (value) => String(value || '').trim().toUpperCase();

const buildCompositeKey = (type, value) => `${type}:${value}`;

class ExposureKeyRegistry {
  static rules = new Map();

  static register(type, resolver) {
    this.rules.set(type, resolver);
  }

  static resolveByBet(bet = {}) {
    const candidates = [
      bet.gameTypeTemplateKey,
      normalizeCode(bet.gameTypeCodeSnapshot),
      normalizeCode(bet.gameTypeCode),
      normalizeCode(bet.gameType),
    ].filter(Boolean);

    for (const candidate of candidates) {
      const resolver = this.rules.get(candidate);
      if (resolver) {
        return resolver;
      }
    }

    return null;
  }

  static getCandidateCompositeKeys({ candidate = {}, context = {}, mode }) {
    if (mode !== BET_MODE.CLOSE) {
      return [];
    }

    const openPana = context.openPana ? canonicalizePana(context.openPana) : '';
    const openDigit = context.openDigit === null || context.openDigit === undefined
      ? null
      : String(context.openDigit);
    const closePana = candidate.outcomePana ? canonicalizePana(candidate.outcomePana) : '';
    const closeDigit = candidate.outcomeDigit === null || candidate.outcomeDigit === undefined
      ? null
      : String(candidate.outcomeDigit);

    const keys = [];

    if (openPana && closeDigit !== null) {
      keys.push(buildCompositeKey('HS_A', `${openPana}_${closeDigit}`));
    }

    if (openDigit !== null && closePana) {
      keys.push(buildCompositeKey('HS_B', `${openDigit}_${closePana}`));
    }

    if (openPana && closePana) {
      keys.push(buildCompositeKey('FS', `${openPana}_${closePana}`));
    }

    return keys;
  }
}

const registerDefaults = () => {
  const singleResolver = ({ selection, potentialPayout, betMode }) => ({
    mode: betMode,
    delta: {
      singleExposure: { [normalizeSelection(selection)]: potentialPayout },
    },
  });

  ExposureKeyRegistry.register(TEMPLATE.SINGLE_DIGIT, singleResolver);
  ExposureKeyRegistry.register('SINGLE', singleResolver);

  const jodiResolver = ({ selection, potentialPayout }) => ({
    mode: BET_MODE.CLOSE,
    delta: {
      jodiExposure: { [normalizeSelection(selection)]: potentialPayout },
    },
  });

  ExposureKeyRegistry.register(TEMPLATE.JODI, jodiResolver);
  ExposureKeyRegistry.register('JODI', jodiResolver);

  const panaResolver = ({ selection, potentialPayout, betMode }) => ({
    mode: betMode,
    delta: {
      panaExposure: { [normalizeSelection(selection)]: potentialPayout },
    },
  });

  ExposureKeyRegistry.register(TEMPLATE.SINGLE_PANA, panaResolver);
  ExposureKeyRegistry.register(TEMPLATE.DOUBLE_PANA, panaResolver);
  ExposureKeyRegistry.register(TEMPLATE.TRIPLE_PANA, panaResolver);
  ExposureKeyRegistry.register('SP', panaResolver);
  ExposureKeyRegistry.register('DP', panaResolver);
  ExposureKeyRegistry.register('TP', panaResolver);

  const halfSangamAResolver = ({ selection, potentialPayout }) => ({
    mode: BET_MODE.CLOSE,
    delta: {
      compositeExposure: {
        [buildCompositeKey('HS_A', normalizeSelection(selection))]: potentialPayout,
      },
    },
  });

  ExposureKeyRegistry.register(TEMPLATE.HALF_SANGAM_A, halfSangamAResolver);
  ExposureKeyRegistry.register('HS_A', halfSangamAResolver);

  const halfSangamBResolver = ({ selection, potentialPayout }) => ({
    mode: BET_MODE.CLOSE,
    delta: {
      compositeExposure: {
        [buildCompositeKey('HS_B', normalizeSelection(selection))]: potentialPayout,
      },
    },
  });

  ExposureKeyRegistry.register(TEMPLATE.HALF_SANGAM_B, halfSangamBResolver);
  ExposureKeyRegistry.register('HS_B', halfSangamBResolver);

  const fullSangamResolver = ({ selection, potentialPayout }) => ({
    mode: BET_MODE.CLOSE,
    delta: {
      compositeExposure: {
        [buildCompositeKey('FS', normalizeSelection(selection))]: potentialPayout,
      },
    },
  });

  ExposureKeyRegistry.register(TEMPLATE.FULL_SANGAM, fullSangamResolver);
  ExposureKeyRegistry.register('FS', fullSangamResolver);

  const spMotorResolver = ({ betMode }) => ({
    mode: betMode,
    motorType: 'SP_MOTOR',
    distribution: 'snapshot',
  });

  const dpMotorResolver = ({ betMode }) => ({
    mode: betMode,
    motorType: 'DP_MOTOR',
    distribution: 'snapshot',
  });

  ExposureKeyRegistry.register(TEMPLATE.SP_MOTOR, spMotorResolver);
  ExposureKeyRegistry.register('SP_MOTOR', spMotorResolver);
  ExposureKeyRegistry.register(TEMPLATE.DP_MOTOR, dpMotorResolver);
  ExposureKeyRegistry.register('DP_MOTOR', dpMotorResolver);
};

registerDefaults();

module.exports = ExposureKeyRegistry;
