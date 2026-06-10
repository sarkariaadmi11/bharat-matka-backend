'use strict';

const { canonicalizePana } = require('@utils/panaCanonicalization');

/**
 * Derives the single result digit from a pana string (sum of digits % 10).
 */
const deriveDigitFromPana = (pana) =>
  String(pana)
    .split('')
    .reduce((sum, d) => sum + parseInt(d, 10), 0) % 10;

/**
 * Builds a temporary plain-JS session snapshot for close-phase preview
 * evaluation by injecting the admin's selected close pana into session.result.
 *
 * WHY: During close preview, session.result.closeDigit and closePana are null
 * because the close result has not been declared yet. ResultEvaluator.isWinningBet
 * reads these fields directly from session.result to evaluate Jodi and Sangam bets.
 * We inject the preview values so the evaluator can resolve combined winners
 * without any database writes.
 *
 * The returned value is a plain JS object, never a Mongoose document, so callers
 * cannot accidentally save it back to the database.
 *
 * @param {object|import('mongoose').Document} session - GameSession document
 * @param {string} previewClosePana - Admin's selected pana for close preview
 * @returns {object} Merged session snapshot with temporary close result
 */
const buildClosePreviewSession = (session, previewClosePana) => {
  const normalizedClosePana = canonicalizePana(String(previewClosePana));
  const closeDigit = deriveDigitFromPana(normalizedClosePana);

  const sessionObj = typeof session.toObject === 'function'
    ? session.toObject()
    : { ...session };

  return {
    ...sessionObj,
    result: {
      ...(sessionObj.result || {}),
      closePana: normalizedClosePana,
      closeDigit,
    },
  };
};

module.exports = { buildClosePreviewSession, deriveDigitFromPana };
