const ExposureCalculator = require('@domain/rule-engine/ExposureCalculator');

describe('ExposureCalculator realistic risk-book scenarios', () => {
  test('calculates exposure correctly for mixed single-digit and pana bet book', () => {
    // Arrange
    const bets = [
      { selection: '4', amount: 1000, oddsSnapshot: 9 },
      { selection: '4', amount: 500, oddsSnapshot: 9 },
      { selection: '7', amount: 800, oddsSnapshot: 9 },
      { selection: '128', amount: 300, oddsSnapshot: 150 },
      { selection: '128', amount: 100, oddsSnapshot: 150 },
      { selection: 'x-invalid', amount: 2000, oddsSnapshot: 999 },
    ];

    // Act
    const exposure = ExposureCalculator.calculate(bets);

    // Assert
    expect(exposure.totalCollection).toBe(4700);
    expect(exposure.totalBets).toBe(6);
    expect(exposure.digitExposureMap.get('4')).toBe(13500);
    expect(exposure.digitExposureMap.get('7')).toBe(7200);
    expect(exposure.panaExposureMap.get('128')).toBe(60000);
    expect(exposure.digitStats[4]).toEqual({
      digit: '4',
      betCount: 2,
      totalAmount: 1500,
      potentialPayout: 13500,
    });
    expect(exposure.digitStats[7]).toEqual({
      digit: '7',
      betCount: 1,
      totalAmount: 800,
      potentialPayout: 7200,
    });
  });

  test('keeps collection totals while excluding invalid selections from risk maps', () => {
    // Arrange
    const bets = [
      { selection: 'AB', amount: 1000, oddsSnapshot: 50 },
      { selection: '', amount: 500, oddsSnapshot: 10 },
    ];

    // Act
    const exposure = ExposureCalculator.calculate(bets);

    // Assert
    expect(exposure.totalCollection).toBe(1500);
    expect(exposure.totalBets).toBe(2);
    expect(exposure.digitExposureMap.size).toBe(0);
    expect(exposure.panaExposureMap.size).toBe(0);
  });

  test('reconstructs digit and pana liabilities from summary aggregation rows', () => {
    // Arrange
    const summary = {
      bySelection: [
        { _id: '2', totalAmount: 2000, totalPotentialPayout: 18000, betCount: 4 },
        { _id: '8', totalAmount: 900, totalPotentialPayout: 8100, betCount: 2 },
        { _id: '555', totalAmount: 300, totalPotentialPayout: 45000, betCount: 1 },
      ],
      totals: {
        totalCollection: 3200,
        totalBets: 7,
      },
    };

    // Act
    const exposure = ExposureCalculator.calculateFromSummary(summary);

    // Assert
    expect(exposure.totalCollection).toBe(3200);
    expect(exposure.totalBets).toBe(7);
    expect(exposure.digitExposureMap.get('2')).toBe(18000);
    expect(exposure.digitExposureMap.get('8')).toBe(8100);
    expect(exposure.panaExposureMap.get('555')).toBe(45000);
    expect(exposure.digitStats[2]).toEqual({
      digit: '2',
      betCount: 4,
      totalAmount: 2000,
      potentialPayout: 18000,
    });
  });
});
