const { dpMotorCombinations, spMotorCombinations } = require('./combinationFormulas');

const GAME_TYPE_RULES = Object.freeze({
  SINGLE_DIGIT: {
    maxDigits: 10,
    maxCombinations: 10,
    formula: 'SINGLE',
  },
  SP_MOTOR: {
    maxDigits: 10,
    formula: 'SP',
    generator: spMotorCombinations,
  },
  DP_MOTOR: {
    maxDigits: 10,
    formula: 'DP',
    generator: dpMotorCombinations,
  },
});

const getGameTypeRule = (type) => GAME_TYPE_RULES[type] || null;

module.exports = {
  GAME_TYPE_RULES,
  getGameTypeRule,
};
