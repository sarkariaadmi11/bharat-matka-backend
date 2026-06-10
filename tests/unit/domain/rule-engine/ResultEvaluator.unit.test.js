const ResultEvaluator = require('@domain/rule-engine/ResultEvaluator');
const { TEMPLATE } = require('@domain/rule-engine/GameTypeRegistry');
const BettingRuleEngine = require('@domain/rule-engine/BettingRuleEngine');

describe('ResultEvaluator settlement scenarios', () => {
  test('identifies winners correctly for a declared pana result', () => {
    // Arrange
    const bets = [
      { selection: '128', gameTypeCodeSnapshot: 'SP' },
      { selection: '129', gameTypeCodeSnapshot: 'SP' },
      { selection: '8', gameTypeCodeSnapshot: 'SINGLE' },
    ];

    // Act
    const { winners, losers } = ResultEvaluator.splitWinnersAndLosers({
      bets,
      result: { pana: '128', digit: 8 },
      session: {},
    });

    // Assert
    expect(winners).toEqual([
      { selection: '128', gameTypeCodeSnapshot: 'SP' },
      { selection: '8', gameTypeCodeSnapshot: 'SINGLE' },
    ]);
    expect(losers).toEqual([{ selection: '129', gameTypeCodeSnapshot: 'SP' }]);
  });

  test('simulates settlement and computes correct payout plus house profit', () => {
    // Arrange
    const engine = new BettingRuleEngine();
    const settledResult = { digit: 4, pana: '128' };
    const bets = [
      { selection: '4', gameTypeCodeSnapshot: 'SINGLE', amount: 1000, oddsSnapshot: 9 },
      { selection: '8', gameTypeCodeSnapshot: 'SINGLE', amount: 1000, oddsSnapshot: 9 },
      { selection: '128', gameTypeCodeSnapshot: 'SP', amount: 200, oddsSnapshot: 150 },
      { selection: '555', gameTypeCodeSnapshot: 'SP', amount: 200, oddsSnapshot: 150 },
    ];

    // Act
    const { winners, losers } = ResultEvaluator.splitWinnersAndLosers({
      bets,
      result: settledResult,
      session: {},
    });
    const totalCollection = bets.reduce((sum, bet) => sum + bet.amount, 0);
    const totalPayout = winners.reduce((sum, bet) => sum + engine.calculatePayout({ bet }), 0);
    const houseProfit = totalCollection - totalPayout;

    // Assert
    expect(winners).toHaveLength(2);
    expect(losers).toHaveLength(2);
    expect(totalCollection).toBe(2400);
    expect(totalPayout).toBe(39000);
    expect(houseProfit).toBe(-36600);
  });

  test('resolves jodi winner from session open and close digits', () => {
    // Arrange
    const bet = { selection: '47', gameTypeTemplateKey: TEMPLATE.JODI };
    const session = { result: { openDigit: 4, closeDigit: 7 } };

    // Act
    const winning = ResultEvaluator.isWinningBet({ bet, session, result: {} });

    // Assert
    expect(winning).toBe(true);
  });

  test('marks jodi and sangam bets as requiring final result declaration', () => {
    // Arrange / Act / Assert
    expect(ResultEvaluator.requiresFinalResult({ gameTypeTemplateKey: TEMPLATE.JODI })).toBe(true);
    expect(ResultEvaluator.requiresFinalResult({ gameTypeCodeSnapshot: 'HS_A' })).toBe(true);
    expect(ResultEvaluator.requiresFinalResult({ gameTypeCodeSnapshot: 'HS_B' })).toBe(true);
    expect(ResultEvaluator.requiresFinalResult({ gameTypeCodeSnapshot: 'FS' })).toBe(true);
    expect(ResultEvaluator.requiresFinalResult({ gameTypeCodeSnapshot: 'SINGLE' })).toBe(false);
  });

  test('returns false for jodi bet when final session digits are incomplete', () => {
    // Arrange
    const bet = { selection: '47', gameTypeCodeSnapshot: 'JODI' };
    const session = { result: { openDigit: 4 } };

    // Act
    const winning = ResultEvaluator.isWinningBet({ bet, result: {}, session });

    // Assert
    expect(winning).toBe(false);
  });

  test('matches half-sangam using session open pana and close digit', () => {
    // Arrange
    const bet = { selection: '123_4', gameTypeCodeSnapshot: 'HS_A' };
    const session = { result: { openPana: '123', closeDigit: 4 } };

    // Act
    const winning = ResultEvaluator.isWinningBet({ bet, result: {}, session });

    // Assert
    expect(winning).toBe(true);
  });

  test('matches SP_MOTOR bet when result pana exists in generatedPanas', () => {
    const bet = {
      gameTypeTemplateKey: TEMPLATE.SP_MOTOR,
      generatedPanas: ['123', '235', '678'],
    };

    const winning = ResultEvaluator.isWinningBet({
      bet,
      result: { pana: '235', digit: 0 },
      session: {},
    });

    expect(winning).toBe(true);
  });

  test('does not match SP_MOTOR bet by resultant digit alone', () => {
    const bet = {
      gameTypeTemplateKey: TEMPLATE.SP_MOTOR,
      generatedPanas: ['136', '145'],
    };

    const winning = ResultEvaluator.isWinningBet({
      bet,
      result: { pana: '127', digit: 0 },
      session: {},
    });

    expect(winning).toBe(false);
  });

  test('matches canonical pana bets after normalizing 0 as highest', () => {
    const bet = { selection: '120', gameTypeCodeSnapshot: 'SP' };

    const winning = ResultEvaluator.isWinningBet({
      bet,
      result: { pana: '012', digit: 3 },
      session: {},
    });

    expect(winning).toBe(true);
  });

  test('matches DP_MOTOR bet when result pana exists in generatedPanas', () => {
    const bet = {
      gameTypeTemplateKey: TEMPLATE.DP_MOTOR,
      generatedPanas: ['112', '113', '122', '133', '223', '233'],
    };

    const winning = ResultEvaluator.isWinningBet({
      bet,
      result: { pana: '233', digit: 0 },
      session: {},
    });

    expect(winning).toBe(true);
  });
});
