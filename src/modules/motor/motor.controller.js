const asyncHandler = require('@utils/asyncHandler');
const { sendSuccess } = require('@utils/response');
const motorService = require('./motor.service');

const generateMotor = asyncHandler(async (req, res) => {
  const data = motorService.generateMotor(req.body);
  sendSuccess(res, data, 'Motor combinations generated');
});

module.exports = {
  generateMotor,
};
