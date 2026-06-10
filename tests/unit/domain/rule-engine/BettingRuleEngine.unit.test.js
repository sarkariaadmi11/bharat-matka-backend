const { BET_MODE, GAME_TYPE_PHASE, SESSION_PHASE } = require('@config/constants/domain');
const { ValidationError } = require('@utils/errors');
const BettingRuleEngine = require('@domain/rule-engine/BettingRuleEngine');

describe('BettingRuleEngine real betting validation flows', () => {
  const buildEngine = (now = new Date('2026-03-13T12:00:00.000Z')) =>
    new BettingRuleEngine({ nowProvider: () => now });

  const singleDigitGameType = {
    code: 'SINGLE',
    betPhaseType: GAME_TYPE_PHASE.BOTH,
    rules: {
      allowedBetModes: [BET_MODE.OPEN, BET_MODE.CLOSE],
      parts: [{ name: 'digit', type: 'digit', length: 1 }],
    },
  };

  const halfSangamA = {
    code: 'HS_A',
    betPhaseType: GAME_TYPE_PHASE.OPEN_ONLY,
    rules: {
      allowedBetModes: [BET_MODE.OPEN],
      parts: [
        { name: 'openPana', type: 'pana', length: 3, panaKind: 'any' },
        { name: 'closeDigit', type: 'digit', length: 1 },
      ],
    },
  };

  test('rejects bet when market is closed', () => {
    // Arrange
    const engine = buildEngine();
    const bet = { betMode: BET_MODE.OPEN, value: { digit: '7' } };
    const session = { phase: SESSION_PHASE.MARKET_CLOSED };

    // Act / Assert
    expect(() =>
      engine.validateBet({
        bet,
        gameType: singleDigitGameType,
        session,
      })).toThrow('Market is closed. No more bets allowed.');
  });

  test('rejects open bet after open result declaration', () => {
    // Arrange
    const engine = buildEngine(new Date('2026-03-13T12:00:00.000Z'));
    const bet = { betMode: BET_MODE.OPEN, value: { digit: '5' } };
    const session = {
      phase: SESSION_PHASE.OPEN_RUNNING,
      openResultDeclared: true,
      openTime: new Date('2026-03-13T11:00:00.000Z'),
    };

    // Act / Assert
    expect(() =>
      engine.validateBet({
        bet,
        gameType: singleDigitGameType,
        session,
      })).toThrow('Open betting has ended. Cannot place open bets after open result.');
  });

  test('rejects bet when game type is open-only and user places close bet', () => {
    // Arrange
    const engine = buildEngine();
    const phaseRestrictedGameType = {
      ...halfSangamA,
      rules: {
        ...halfSangamA.rules,
        allowedBetModes: [BET_MODE.OPEN, BET_MODE.CLOSE],
      },
    };
    const bet = {
      betMode: BET_MODE.CLOSE,
      value: { openPana: '128', closeDigit: '7' },
    };
    const session = {
      phase: SESSION_PHASE.OPEN_RUNNING,
      openResultDeclared: false,
      openTime: new Date('2026-03-13T16:00:00.000Z'),
    };

    // Act / Assert
    expect(() =>
      engine.validateBet({
        bet,
        gameType: phaseRestrictedGameType,
        session,
      })).toThrow('HS_A bets can only be placed in OPEN mode');
  });

  test('accepts a valid half-sangam open bet before cut-off time', () => {
    // Arrange
    const engine = buildEngine(new Date('2026-03-13T10:30:00.000Z'));
    const bet = {
      betMode: BET_MODE.OPEN,
      value: { openPana: '128', closeDigit: '7' },
    };
    const session = {
      phase: SESSION_PHASE.OPEN_RUNNING,
      openResultDeclared: false,
      openTime: new Date('2026-03-13T11:00:00.000Z'),
    };

    // Act
    const isValid = engine.validateBet({
      bet,
      gameType: halfSangamA,
      session,
    });

    // Assert
    expect(isValid).toBe(true);
  });

  test('rejects malformed pana input to protect from invalid financial entries', () => {
    // Arrange
    const engine = buildEngine();

    // Act / Assert
    expect(() =>
      engine.validateBetValue({
        value: { openPana: '12A', closeDigit: '7' },
        rules: halfSangamA.rules,
      })).toThrow('Part openPana must be a valid any pana');
  });

  test('calculates payout using stake and locked odds snapshot', () => {
    // Arrange
    const engine = buildEngine();
    const bet = { amount: 2500, oddsSnapshot: 95 };

    // Act
    const payout = engine.calculatePayout({ bet });

    // Assert
    expect(payout).toBe(237500);
  });

  test('calculates SP_MOTOR payout from stakePerCombination snapshot', () => {
    const engine = buildEngine();
    const bet = {
      amount: 10000,
      stakePerCombination: 2500,
      oddsSnapshot: 120,
      gameTypeCodeSnapshot: 'SP_MOTOR',
      generatedPanas: ['128', '129'],
    };

    const payout = engine.calculatePayout({ bet, resultPana: '128' });

    expect(payout).toBe(300000);
  });

  test('calculates SP_MOTOR payout from motorLineStakesPaise when result pana matches', () => {
    const engine = buildEngine();
    const bet = {
      amount: 3000,
      oddsSnapshot: 100,
      gameTypeCodeSnapshot: 'SP_MOTOR',
      generatedPanas: ['100', '200'],
      motorLineStakesPaise: { 100: 2000, 200: 1000 },
    };

    expect(engine.calculatePayout({ bet, resultPana: '100' })).toBe(200000);
    expect(engine.calculatePayout({ bet, resultPana: '200' })).toBe(100000);
  });

  test('derives digit from pana for downstream result matching', () => {
    // Arrange
    const engine = buildEngine();

    // Act
    const derivedDigit = engine.deriveDigitFromPana('128');

    // Assert
    expect(derivedDigit).toBe(1);
  });

  test('allows triple zero pana (000) for digit derivation', () => {
    const engine = buildEngine();
    const derivedDigit = engine.deriveDigitFromPana('000');
    expect(derivedDigit).toBe(0);
  });

  test('throws validation error for invalid pana length during digit derivation', () => {
    // Arrange
    const engine = buildEngine();

    // Act / Assert
    expect(() => engine.deriveDigitFromPana('12')).toThrow(ValidationError);
  });
});
