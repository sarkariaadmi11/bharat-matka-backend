const { ExposureCalculator } = require('@domain/rule-engine');
const { simulateOutcomes } = require('@modules/results/engine/OutcomeSimulator');

describe('Rule engine simulation profit safety', () => {
  test('simulates multiple outcomes and computes net profit correctly', () => {
    // Arrange
    const bets = [
      { selection: '4', amount: 1000, oddsSnapshot: 9 },
      { selection: '4', amount: 500, oddsSnapshot: 9 },
      { selection: '7', amount: 500, oddsSnapshot: 9 },
      { selection: '128', amount: 200, oddsSnapshot: 150 },
      { selection: '555', amount: 100, oddsSnapshot: 150 },
    ];

    const exposure = ExposureCalculator.calculate(bets);

    // Act
    const simulation = simulateOutcomes(exposure);

    const highRisk128 = simulation.riskOutcomes.find((item) => item.outcomePana === '128');
    const digitOnly130 = simulation.topOutcomes.find((item) => item.outcomePana === '130');

    // Assert
    expect(simulation.totalScenarios).toBe(220);
    expect(simulation.totalCollection).toBe(2300);

    expect(highRisk128).toBeDefined();
    expect(highRisk128.totalPayout).toBe(30000);
    expect(highRisk128.netProfit).toBe(-27700);

    expect(digitOnly130).toBeDefined();
    expect(digitOnly130.totalPayout).toBe(13500);
    expect(digitOnly130.netProfit).toBe(-11200);

    // Highest-risk outcomes must be sorted by payout desc.
    expect(simulation.riskOutcomes[0].totalPayout).toBeGreaterThanOrEqual(simulation.riskOutcomes[1].totalPayout);
  });
});
