'use strict';

/**
 * Tests for CombinedGamePreviewService and previewSessionBuilder.
 *
 * These tests exercise the fix for combined-result game types (Jodi, Sangam)
 * not appearing in the winner preview list during close phase preview.
 *
 * Root causes fixed:
 *   1. Jodi/Sangam bets stored with betMode='open' were excluded from close
 *      preview fetch (betMode='close' filter).
 *   2. ResultEvaluator reads closeDigit/closePana from session.result, which
 *      are null before declaration, causing every combined bet to return false.
 */

const {
  evaluateCombinedResultBetsForPreview,
  hasOpenResultDeclared,
  isCombinedResultBet,
} = require('@domain/preview/CombinedGamePreviewService');

const { buildClosePreviewSession, deriveDigitFromPana } = require('@domain/preview/previewSessionBuilder');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSession = ({ result: resultOverrides = {}, ...rest } = {}) => ({
  _id: 'session-001',
  marketId: 'market-001',
  result: {
    openPana: null,
    openDigit: null,
    closePana: null,
    closeDigit: null,
    openDeclaredAt: null,
    closeDeclaredAt: null,
    ...resultOverrides,
  },
  ...rest,
});

const makeBet = (overrides = {}) => ({
  _id: `bet-${Math.random().toString(36).slice(2)}`,
  userId: 'user-001',
  sessionId: 'session-001',
  gameTypeId: 'gt-001',
  betMode: 'open',
  status: 'pending',
  amount: 10000,
  oddsSnapshot: 90,
  stakePerCombination: null,
  generatedPanas: null,
  gameTypeTemplateKey: null,
  gameTypeCodeSnapshot: null,
  selection: '00',
  ...overrides,
});

// ---------------------------------------------------------------------------
// deriveDigitFromPana
// ---------------------------------------------------------------------------

describe('deriveDigitFromPana', () => {
  test.each([
    ['128', 1],   // 1+2+8=11 → 11%10=1
    ['123', 6],   // 1+2+3=6
    ['000', 0],
    ['999', 7],   // 9+9+9=27 → 27%10=7
    ['500', 5],   // 5+0+0=5
    ['890', 7],   // 8+9+0=17 → 17%10=7
    ['6', 6],
  ])('pana %s → digit %i', (pana, expected) => {
    expect(deriveDigitFromPana(pana)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// buildClosePreviewSession
// ---------------------------------------------------------------------------

describe('buildClosePreviewSession', () => {
  it('injects closePana and closeDigit into session.result', () => {
    const session = makeSession({ result: { openPana: '128', openDigit: 1 } });
    const merged = buildClosePreviewSession(session, '236');

    expect(merged.result.openPana).toBe('128');
    expect(merged.result.openDigit).toBe(1);
    expect(merged.result.closePana).toBe('236');
    expect(merged.result.closeDigit).toBe(1); // 2+3+6=11 → 11%10=1
  });

  it('does not mutate the original session', () => {
    const session = makeSession({ result: { openPana: '128', openDigit: 1 } });
    buildClosePreviewSession(session, '500');

    expect(session.result.closePana).toBeNull();
    expect(session.result.closeDigit).toBeNull();
  });

  it('handles Mongoose document by calling toObject()', () => {
    const session = makeSession({ result: { openPana: '128', openDigit: 1 } });
    const mongooseDoc = { ...session, toObject: () => session };

    const merged = buildClosePreviewSession(mongooseDoc, '500');
    expect(merged.result.closePana).toBe('500');
    expect(merged.result.closeDigit).toBe(5);
  });

  it('canonicalizes the pana before injecting', () => {
    // "321" → sorted digits → "123"
    const session = makeSession({ result: { openPana: '128', openDigit: 1 } });
    const merged = buildClosePreviewSession(session, '321');
    expect(merged.result.closePana).toBe('123');
  });
});

// ---------------------------------------------------------------------------
// hasOpenResultDeclared
// ---------------------------------------------------------------------------

describe('hasOpenResultDeclared', () => {
  it('returns true when openDigit is 0 (zero is a valid digit)', () => {
    const session = makeSession({ result: { openDigit: 0 } });
    expect(hasOpenResultDeclared(session)).toBe(true);
  });

  it('returns true when openDigit is non-zero', () => {
    const session = makeSession({ result: { openDigit: 6 } });
    expect(hasOpenResultDeclared(session)).toBe(true);
  });

  it('returns false when openDigit is null', () => {
    const session = makeSession({ result: { openDigit: null } });
    expect(hasOpenResultDeclared(session)).toBe(false);
  });

  it('returns false when openDigit is undefined', () => {
    const session = makeSession({ result: {} });
    expect(hasOpenResultDeclared(session)).toBe(false);
  });

  it('returns false when session.result is missing', () => {
    expect(hasOpenResultDeclared({ _id: 'x' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isCombinedResultBet
// ---------------------------------------------------------------------------

describe('isCombinedResultBet', () => {
  it.each([
    ['JODI', 'JODI', true],
    ['HALF_SANGAM_A', 'HS_A', true],
    ['HALF_SANGAM_B', 'HS_B', true],
    ['FULL_SANGAM', 'FS', true],
    ['SINGLE_DIGIT', 'SINGLE', false],
    ['SINGLE_PANA', 'SP', false],
    ['DOUBLE_PANA', 'DP', false],
    ['SP_MOTOR', 'SP_MOTOR', false],
  ])('templateKey=%s codeSnapshot=%s → combined=%s', (templateKey, codeSnapshot, expected) => {
    const bet = makeBet({ gameTypeTemplateKey: templateKey, gameTypeCodeSnapshot: codeSnapshot });
    expect(isCombinedResultBet(bet)).toBe(expected);
  });

  it('detects Jodi by selection length=2 when templateKey is missing', () => {
    const bet = makeBet({ gameTypeTemplateKey: null, gameTypeCodeSnapshot: null, selection: '66' });
    expect(isCombinedResultBet(bet)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateCombinedResultBetsForPreview — JODI
// ---------------------------------------------------------------------------

describe('JODI preview evaluation', () => {
  const session = makeSession({
    result: { openPana: '128', openDigit: 1 }, // open digit = 1
  });
  const previewClosePana = '100'; // close digit = 1+0+0=1

  it('matches Jodi "11" when open digit=1 and preview close digit=1', () => {
    const bet = makeBet({
      gameTypeTemplateKey: 'JODI',
      gameTypeCodeSnapshot: 'JODI',
      selection: '11',
    });
    const { winners, losers } = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana,
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(0);
    expect(winners[0].selection).toBe('11');
  });

  it('does NOT match Jodi "16" when preview close digit=1 (not 6)', () => {
    const bet = makeBet({
      gameTypeTemplateKey: 'JODI',
      gameTypeCodeSnapshot: 'JODI',
      selection: '16',
    });
    const { winners, losers } = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana,
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(0);
    expect(losers).toHaveLength(1);
  });

  it('matches Jodi "66" when open digit=6 and preview close digit=6', () => {
    const sessionWith6 = makeSession({ result: { openPana: '123', openDigit: 6 } });
    const bet = makeBet({
      gameTypeTemplateKey: 'JODI',
      gameTypeCodeSnapshot: 'JODI',
      selection: '66',
    });
    const { winners } = evaluateCombinedResultBetsForPreview({
      session: sessionWith6,
      previewClosePana: '600', // 6+0+0=6
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(1);
  });

  it('returns losers (not winners) when open result is not yet declared', () => {
    const sessionNoOpen = makeSession({ result: { openDigit: null, openPana: null } });
    const bet = makeBet({ gameTypeTemplateKey: 'JODI', selection: '66' });
    const { winners, losers } = evaluateCombinedResultBetsForPreview({
      session: sessionNoOpen,
      previewClosePana: '600',
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(0);
    expect(losers).toHaveLength(1);
  });

  it('returns empty when combinedBets array is empty', () => {
    const result = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana: '100',
      combinedBets: [],
    });
    expect(result.winners).toHaveLength(0);
    expect(result.losers).toHaveLength(0);
  });

  it('returns empty when combinedBets is null', () => {
    const result = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana: '100',
      combinedBets: null,
    });
    expect(result.winners).toHaveLength(0);
    expect(result.losers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateCombinedResultBetsForPreview — HALF SANGAM A (openPana_closeDigit)
// ---------------------------------------------------------------------------

describe('Half Sangam A preview evaluation (openPana_closeDigit)', () => {
  // Open declared: openPana="128" → openDigit=1
  // Preview close pana: "500" → closeDigit=5
  // Winning selection: "128_5"
  const session = makeSession({ result: { openPana: '128', openDigit: 1 } });
  const previewClosePana = '500';

  it('matches "128_5" when openPana=128 and preview closeDigit=5', () => {
    const bet = makeBet({
      gameTypeTemplateKey: 'HALF_SANGAM_A',
      gameTypeCodeSnapshot: 'HS_A',
      selection: '128_5',
    });
    const { winners } = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana,
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(1);
  });

  it('does NOT match "128_6" when preview closeDigit=5', () => {
    const bet = makeBet({
      gameTypeTemplateKey: 'HALF_SANGAM_A',
      gameTypeCodeSnapshot: 'HS_A',
      selection: '128_6',
    });
    const { winners, losers } = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana,
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(0);
    expect(losers).toHaveLength(1);
  });

  it('does NOT match when openPana not declared', () => {
    const sessionNoOpen = makeSession({ result: { openDigit: null, openPana: null } });
    const bet = makeBet({
      gameTypeTemplateKey: 'HALF_SANGAM_A',
      selection: '128_5',
    });
    const { winners } = evaluateCombinedResultBetsForPreview({
      session: sessionNoOpen,
      previewClosePana,
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateCombinedResultBetsForPreview — HALF SANGAM B (openDigit_closePana)
// ---------------------------------------------------------------------------

describe('Half Sangam B preview evaluation (openDigit_closePana)', () => {
  // Open declared: openDigit=6
  // Preview close pana: "500" → closePana="500"
  // Winning selection: "6_500"
  const session = makeSession({ result: { openPana: '123', openDigit: 6 } });
  const previewClosePana = '500';

  it('matches "6_500" when openDigit=6 and preview closePana=500', () => {
    const bet = makeBet({
      gameTypeTemplateKey: 'HALF_SANGAM_B',
      gameTypeCodeSnapshot: 'HS_B',
      selection: '6_500',
    });
    const { winners } = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana,
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(1);
  });

  it('does NOT match "6_123" when preview closePana=500', () => {
    const bet = makeBet({
      gameTypeTemplateKey: 'HALF_SANGAM_B',
      gameTypeCodeSnapshot: 'HS_B',
      selection: '6_123',
    });
    const { winners, losers } = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana,
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(0);
    expect(losers).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// evaluateCombinedResultBetsForPreview — FULL SANGAM (openPana_closePana)
// ---------------------------------------------------------------------------

describe('Full Sangam preview evaluation (openPana_closePana)', () => {
  // Open declared: openPana="128"
  // Preview close pana: "500" → closePana="500"
  // Winning selection: "128_500"
  const session = makeSession({ result: { openPana: '128', openDigit: 1 } });
  const previewClosePana = '500';

  it('matches "128_500" when openPana=128 and preview closePana=500', () => {
    const bet = makeBet({
      gameTypeTemplateKey: 'FULL_SANGAM',
      gameTypeCodeSnapshot: 'FS',
      selection: '128_500',
    });
    const { winners } = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana,
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(1);
  });

  it('does NOT match "128_236" when preview closePana=500', () => {
    const bet = makeBet({
      gameTypeTemplateKey: 'FULL_SANGAM',
      gameTypeCodeSnapshot: 'FS',
      selection: '128_236',
    });
    const { winners, losers } = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana,
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(0);
    expect(losers).toHaveLength(1);
  });

  it('does NOT match when openPana is not declared', () => {
    const sessionNoOpen = makeSession({ result: { openDigit: null, openPana: null } });
    const bet = makeBet({
      gameTypeTemplateKey: 'FULL_SANGAM',
      selection: '128_500',
    });
    const { winners } = evaluateCombinedResultBetsForPreview({
      session: sessionNoOpen,
      previewClosePana,
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Mixed game types in a single preview call
// ---------------------------------------------------------------------------

describe('Mixed combined-result game types in one preview', () => {
  // openPana="128", openDigit=1
  // previewClosePana="100" → closeDigit=1, closePana="100"
  const session = makeSession({ result: { openPana: '128', openDigit: 1 } });
  const previewClosePana = '100';

  it('correctly identifies winners across Jodi, HS-A, HS-B, and Full Sangam', () => {
    const bets = [
      makeBet({ gameTypeTemplateKey: 'JODI', selection: '11' }),          // openDigit=1, closeDigit=1 → WIN
      makeBet({ gameTypeTemplateKey: 'JODI', selection: '16' }),          // closeDigit≠6 → LOSE
      makeBet({ gameTypeTemplateKey: 'HALF_SANGAM_A', selection: '128_1' }), // openPana=128, closeDigit=1 → WIN
      makeBet({ gameTypeTemplateKey: 'HALF_SANGAM_A', selection: '128_6' }), // closeDigit≠6 → LOSE
      makeBet({ gameTypeTemplateKey: 'HALF_SANGAM_B', selection: '1_100' }), // openDigit=1, closePana=100 → WIN
      makeBet({ gameTypeTemplateKey: 'HALF_SANGAM_B', selection: '1_236' }), // closePana≠236 → LOSE
      makeBet({ gameTypeTemplateKey: 'FULL_SANGAM', selection: '128_100' }), // openPana=128, closePana=100 → WIN
      makeBet({ gameTypeTemplateKey: 'FULL_SANGAM', selection: '128_236' }), // closePana≠236 → LOSE
    ];

    const { winners, losers } = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana,
      combinedBets: bets,
    });

    expect(winners).toHaveLength(4);
    expect(losers).toHaveLength(4);

    const winSelections = winners.map((b) => b.selection).sort();
    expect(winSelections).toEqual(['11', '128_1', '128_100', '1_100'].sort());
  });
});

// ---------------------------------------------------------------------------
// Pana canonicalization in preview session
// ---------------------------------------------------------------------------

describe('Pana canonicalization edge cases', () => {
  it('normalizes preview close pana before evaluating (digits sorted 0-high)', () => {
    // "321" canonicalizes to "123" — bet on "128_3" vs closeDigit derived from "321"=6
    // But "321"→canonical "123", digit=1+2+3=6
    const session = makeSession({ result: { openPana: '128', openDigit: 1 } });
    const bet = makeBet({ gameTypeTemplateKey: 'HALF_SANGAM_A', selection: '128_6' });

    const { winners } = evaluateCombinedResultBetsForPreview({
      session,
      previewClosePana: '321', // canonical "123", digit=6
      combinedBets: [bet],
    });
    expect(winners).toHaveLength(1);
  });
});
