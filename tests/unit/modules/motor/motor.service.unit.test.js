describe('motor.service', () => {
  test('generates motor combinations when enabled', () => {
    jest.resetModules();
    const service = require('@modules/motor/motor.service');

    const result = service.generateMotor({ type: 'SP_MOTOR', digits: [1, 2, 3, 4] });

    expect(result.panas).toEqual(['123', '124', '134', '234']);
    expect(result.count).toBe(4);
  });

  test('generates DP_MOTOR combinations', () => {
    jest.resetModules();
    const service = require('@modules/motor/motor.service');

    const result = service.generateMotor({ type: 'DP_MOTOR', digits: [1, 2, 3] });

    expect(result.panas).toEqual(['112', '113', '122', '133', '223', '233']);
    expect(result.count).toBe(6);
  });

  test('uses zero-highest pana keys for SP_MOTOR combinations that include 0', () => {
    jest.resetModules();
    const service = require('@modules/motor/motor.service');

    const result = service.generateMotor({ type: 'SP_MOTOR', digits: [0, 1, 2] });

    expect(result.panas).toEqual(['120']);
    expect(result.count).toBe(1);
  });
});
