const { CombinationEngine } = require('@domain/combinations');
const { getGameTypeRule } = require('@domain/gameRules');
const { validateGeneratePayload } = require('./motor.validator');

const generateMotor = ({ type, digits }) => {
  validateGeneratePayload({ type, digits });

  const result = CombinationEngine.generate({ type, digits });
  const rule = getGameTypeRule(type);
  return {
    ...result,
    maxCombinations: rule?.maxCombinations ?? null,
  };
};

module.exports = {
  generateMotor,
};
