const DpMotorStrategy = require('@domain/combinations/DpMotorStrategy');

describe('DpMotorStrategy', () => {
  test('generates normalized double-pana combinations', () => {
    const panas = DpMotorStrategy.generate({ digits: [1, 2, 3] });
    expect(panas).toEqual(['112', '113', '122', '133', '223', '233']);
  });

  test('treats 0 as highest when digit 0 is present', () => {
    const panas = DpMotorStrategy.generate({ digits: [0, 1, 2] });
    expect(panas).toEqual(['112', '122', '110', '220', '100', '200']);
  });
});
