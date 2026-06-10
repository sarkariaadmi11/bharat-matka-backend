const { BET_MODE, GAME_TYPE_PHASE } = require('@config/constants/domain');

const PART_TYPE = Object.freeze({
  DIGIT: 'digit',
  PANA: 'pana',
  PANA_SET: 'pana_set',
  DIGIT_SET: 'digit_set',
});

const PANA_KIND = Object.freeze({
  SINGLE: 'single',
  DOUBLE: 'double',
  TRIPLE: 'triple',
  ANY: 'any',
});

const TEMPLATE = Object.freeze({
  SINGLE_DIGIT: 'SINGLE_DIGIT',
  JODI: 'JODI',
  SINGLE_PANA: 'SINGLE_PANA',
  DOUBLE_PANA: 'DOUBLE_PANA',
  TRIPLE_PANA: 'TRIPLE_PANA',
  HALF_SANGAM_A: 'HALF_SANGAM_A',
  HALF_SANGAM_B: 'HALF_SANGAM_B',
  FULL_SANGAM: 'FULL_SANGAM',
  SP_MOTOR: 'SP_MOTOR',
  DP_MOTOR: 'DP_MOTOR',
});

const RULE_TEMPLATES = Object.freeze({
  [TEMPLATE.SINGLE_DIGIT]: {
    templateKey: TEMPLATE.SINGLE_DIGIT,
    format: 'digit',
    parts: [{ name: 'digit', length: 1, type: PART_TYPE.DIGIT }],
    separator: '_',
    allowRepeat: true,
    allowedBetModes: [BET_MODE.OPEN, BET_MODE.CLOSE],
    betPhaseType: GAME_TYPE_PHASE.BOTH,
    constraints: { requiresPana: false, maxParts: 1 },
  },
  [TEMPLATE.JODI]: {
    templateKey: TEMPLATE.JODI,
    format: 'jodi',
    parts: [{ name: 'jodi', length: 2, type: PART_TYPE.DIGIT }],
    separator: '_',
    allowRepeat: true,
    allowedBetModes: [BET_MODE.OPEN],
    betPhaseType: GAME_TYPE_PHASE.OPEN_ONLY,
    constraints: { requiresPana: false, maxParts: 1 },
  },
  [TEMPLATE.SINGLE_PANA]: {
    templateKey: TEMPLATE.SINGLE_PANA,
    format: 'single_pana',
    parts: [{ name: 'pana', length: 3, type: PART_TYPE.PANA, panaKind: PANA_KIND.SINGLE }],
    separator: '_',
    allowRepeat: true,
    allowedBetModes: [BET_MODE.OPEN, BET_MODE.CLOSE],
    betPhaseType: GAME_TYPE_PHASE.BOTH,
    constraints: { requiresPana: true, maxParts: 1 },
  },
  [TEMPLATE.DOUBLE_PANA]: {
    templateKey: TEMPLATE.DOUBLE_PANA,
    format: 'double_pana',
    parts: [{ name: 'pana', length: 3, type: PART_TYPE.PANA, panaKind: PANA_KIND.DOUBLE }],
    separator: '_',
    allowRepeat: true,
    allowedBetModes: [BET_MODE.OPEN, BET_MODE.CLOSE],
    betPhaseType: GAME_TYPE_PHASE.BOTH,
    constraints: { requiresPana: true, maxParts: 1 },
  },
  [TEMPLATE.TRIPLE_PANA]: {
    templateKey: TEMPLATE.TRIPLE_PANA,
    format: 'triple_pana',
    parts: [{ name: 'pana', length: 3, type: PART_TYPE.PANA, panaKind: PANA_KIND.TRIPLE }],
    separator: '_',
    allowRepeat: true,
    allowedBetModes: [BET_MODE.OPEN, BET_MODE.CLOSE],
    betPhaseType: GAME_TYPE_PHASE.BOTH,
    constraints: { requiresPana: true, maxParts: 1 },
  },
  [TEMPLATE.HALF_SANGAM_A]: {
    templateKey: TEMPLATE.HALF_SANGAM_A,
    format: 'openPana_closeDigit',
    parts: [
      { name: 'openPana', length: 3, type: PART_TYPE.PANA, panaKind: PANA_KIND.ANY },
      { name: 'closeDigit', length: 1, type: PART_TYPE.DIGIT },
    ],
    separator: '_',
    allowRepeat: true,
    allowedBetModes: [BET_MODE.OPEN],
    betPhaseType: GAME_TYPE_PHASE.OPEN_ONLY,
    constraints: { requiresPana: true, maxParts: 2 },
  },
  [TEMPLATE.HALF_SANGAM_B]: {
    templateKey: TEMPLATE.HALF_SANGAM_B,
    format: 'openDigit_closePana',
    parts: [
      { name: 'openDigit', length: 1, type: PART_TYPE.DIGIT },
      { name: 'closePana', length: 3, type: PART_TYPE.PANA, panaKind: PANA_KIND.ANY },
    ],
    separator: '_',
    allowRepeat: true,
    allowedBetModes: [BET_MODE.OPEN],
    betPhaseType: GAME_TYPE_PHASE.OPEN_ONLY,
    constraints: { requiresPana: true, maxParts: 2 },
  },
  [TEMPLATE.FULL_SANGAM]: {
    templateKey: TEMPLATE.FULL_SANGAM,
    format: 'openPana_closePana',
    parts: [
      { name: 'openPana', length: 3, type: PART_TYPE.PANA, panaKind: PANA_KIND.ANY },
      { name: 'closePana', length: 3, type: PART_TYPE.PANA, panaKind: PANA_KIND.ANY },
    ],
    separator: '_',
    allowRepeat: true,
    allowedBetModes: [BET_MODE.OPEN],
    betPhaseType: GAME_TYPE_PHASE.OPEN_ONLY,
    constraints: { requiresPana: true, maxParts: 2 },
  },
  [TEMPLATE.SP_MOTOR]: {
    templateKey: TEMPLATE.SP_MOTOR,
    format: 'sp_motor',
    parts: [{ name: 'panas', type: PART_TYPE.PANA_SET, minItems: 1, panaKind: PANA_KIND.SINGLE }],
    separator: ',',
    allowRepeat: false,
    allowedBetModes: [BET_MODE.OPEN, BET_MODE.CLOSE],
    betPhaseType: GAME_TYPE_PHASE.BOTH,
    constraints: { requiresPana: false, maxParts: 1 },
  },
  [TEMPLATE.DP_MOTOR]: {
    templateKey: TEMPLATE.DP_MOTOR,
    format: 'dp_motor',
    parts: [{ name: 'panas', type: PART_TYPE.PANA_SET, minItems: 1, panaKind: PANA_KIND.DOUBLE }],
    separator: ',',
    allowRepeat: false,
    allowedBetModes: [BET_MODE.OPEN, BET_MODE.CLOSE],
    betPhaseType: GAME_TYPE_PHASE.BOTH,
    constraints: { requiresPana: false, maxParts: 1 },
  },
});

const GAME_TYPE_CODE_TO_TEMPLATE = Object.freeze({
  SINGLE: TEMPLATE.SINGLE_DIGIT,
  JODI: TEMPLATE.JODI,
  SP: TEMPLATE.SINGLE_PANA,
  DP: TEMPLATE.DOUBLE_PANA,
  TP: TEMPLATE.TRIPLE_PANA,
  HS_A: TEMPLATE.HALF_SANGAM_A,
  HS_B: TEMPLATE.HALF_SANGAM_B,
  FS: TEMPLATE.FULL_SANGAM,
  SP_MOTOR: TEMPLATE.SP_MOTOR,
  DP_MOTOR: TEMPLATE.DP_MOTOR,
});

const clone = (value) => JSON.parse(JSON.stringify(value));

class GameTypeRegistry {
  static templateKeys() {
    return Object.keys(RULE_TEMPLATES);
  }

  static hasTemplate(templateKey) {
    return Boolean(RULE_TEMPLATES[templateKey]);
  }

  static getTemplate(templateKey) {
    const template = RULE_TEMPLATES[templateKey];
    return template ? clone(template) : null;
  }

  static fromGameType(gameType = {}) {
    const byTemplateField = gameType.templateKey && RULE_TEMPLATES[gameType.templateKey]
      ? RULE_TEMPLATES[gameType.templateKey]
      : null;
    const byCode = gameType.code && GAME_TYPE_CODE_TO_TEMPLATE[gameType.code]
      ? RULE_TEMPLATES[GAME_TYPE_CODE_TO_TEMPLATE[gameType.code]]
      : null;
    return clone(byTemplateField || byCode || null);
  }

  static inferTemplateKey(gameType = {}) {
    if (gameType.templateKey && RULE_TEMPLATES[gameType.templateKey]) {
      return gameType.templateKey;
    }
    if (gameType.code && GAME_TYPE_CODE_TO_TEMPLATE[gameType.code]) {
      return GAME_TYPE_CODE_TO_TEMPLATE[gameType.code];
    }
    return null;
  }

  static buildRulesFromTemplate(templateKey) {
    const template = RULE_TEMPLATES[templateKey];
    if (!template) {
      return null;
    }

    return {
      format: template.format,
      parts: template.parts,
      separator: template.separator,
      allowRepeat: template.allowRepeat,
      allowedBetModes: template.allowedBetModes,
    };
  }
}

module.exports = {
  GameTypeRegistry,
  TEMPLATE,
  PART_TYPE,
  PANA_KIND,
};
