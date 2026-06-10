const SpMotorStrategy = require('@domain/combinations/SpMotorStrategy');

describe('SpMotorStrategy', () => {
  test('generates all normalized C(n,3) combinations', () => {
    const panas = SpMotorStrategy.generate({ digits: [4, 1, 2, 3] });
    expect(panas).toEqual(['123', '124', '134', '234']);
  });

  test('treats 0 as highest when digit 0 is present', () => {
    const panas = SpMotorStrategy.generate({ digits: [0, 1, 2, 3, 4] });
    expect(panas).toEqual(['123', '124', '134', '234', '120', '130', '140', '230', '240', '340']);
  });
});
