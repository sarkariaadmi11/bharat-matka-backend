const { validateMotorPayload } = require('../../validators/motorValidator');

const validateGeneratePayload = (payload = {}) => {
  validateMotorPayload(payload);
};

module.exports = {
  validateGeneratePayload,
};
