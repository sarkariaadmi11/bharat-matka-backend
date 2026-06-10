'use strict';

const ResultEvaluator = require('@domain/rule-engine/ResultEvaluator');
const { buildClosePreviewSession } = require('./previewSessionBuilder');

/**
 * Game types that are placed during the open phase (betMode='open') but require
 * BOTH open and close results to resolve a winner. The settlement engine defers
 * these until the close result is declared; the preview logic must do the same.
 *
 * Stored by gameTypeTemplateKey (modern bets) and gameTypeCodeSnapshot (all bets):
 *   JODI         — openDigit + closeDigit (e.g. "66")
 *   HALF_SANGAM_A — openPana + closeDigit (e.g. "123_6")
 *   HALF_SANGAM_B — openDigit + closePana (e.g. "6_123")
 *   FULL_SANGAM   — openPana + closePana  (e.g. "123_456")
 */
const COMBINED_RESULT_TEMPLATE_KEYS = Object.freeze([
  'JODI',
  'HALF_SANGAM_A',
  'HALF_SANGAM_B',
  'FULL_SANGAM',
]);

const COMBINED_RESULT_CODE_SNAPSHOTS = Object.freeze([
  'JODI',
  'HS_A',
  'HS_B',
  'FS',
]);

/**
 * Returns true when this bet's game type requires both open and close results.
 * Delegates to ResultEvaluator so the detection logic stays in one place.
 */
const isCombinedResultBet = (bet) => ResultEvaluator.requiresFinalResult(bet);

/**
 * Returns true when the session already has a declared open result.
 * Combined-result bets cannot be evaluated without the open digit.
 */
const hasOpenResultDeclared = (session) => {
  const openDigit = session?.result?.openDigit;
  return openDigit !== null && openDigit !== undefined;
};

/**
 * Evaluates Jodi and Sangam bets during close-phase preview.
 *
 * PROBLEM THESE SOLVE:
 *   1. Jodi/Sangam bets are stored with betMode='open' (placed before close phase),
 *      so the standard close preview query (betMode='close') excludes them entirely.
 *   2. ResultEvaluator.isWinningBet reads closeDigit/closePana from session.result,
 *      which are null before declaration, causing every combined bet to return false.
 *
 * FIX:
 *   Build a temporary merged session snapshot with the preview close pana injected,
 *   then run the existing ResultEvaluator against the combined bets and merged session.
 *   Zero database writes; the original session document is never mutated.
 *
 * @param {object}   params
 * @param {object}   params.session            GameSession Mongoose document or plain object
 * @param {string}   params.previewClosePana   Admin's selected pana for close preview
 * @param {object[]} params.combinedBets       Pending open-mode bets that require both results
 * @returns {{ winners: object[], losers: object[] }}
 */
const evaluateCombinedResultBetsForPreview = ({ session, previewClosePana, combinedBets }) => {
  if (!combinedBets || combinedBets.length === 0) {
    return { winners: [], losers: [] };
  }

  // Without a declared open result there is no complete Jodi/Sangam to match against.
  if (!hasOpenResultDeclared(session)) {
    return { winners: [], losers: combinedBets };
  }

  const mergedSession = buildClosePreviewSession(session, previewClosePana);

  // ResultEvaluator.isWinningBet for JODI/SANGAM reads exclusively from
  // session.result (not from the result argument), so tempResult values are
  // irrelevant for these game types. A null-safe object prevents unexpected
  // fallthrough in any edge-case bet type that might share this evaluation path.
  const tempResult = { pana: null, digit: null };

  return ResultEvaluator.splitWinnersAndLosers({
    bets: combinedBets,
    result: tempResult,
    session: mergedSession,
  });
};

module.exports = {
  isCombinedResultBet,
  hasOpenResultDeclared,
  evaluateCombinedResultBetsForPreview,
  COMBINED_RESULT_TEMPLATE_KEYS,
  COMBINED_RESULT_CODE_SNAPSHOTS,
};
