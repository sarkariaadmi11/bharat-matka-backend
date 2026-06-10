const { TEMPLATE } = require('./GameTypeRegistry');
const {
  canonicalizePana,
  canonicalizePanaSelection,
} = require('@utils/panaCanonicalization');

class ResultEvaluator {
  static resolveTemplateKey(bet) {
    if (bet?.gameTypeTemplateKey) {
      return bet.gameTypeTemplateKey;
    }
    if (bet?.gameTypeCodeSnapshot === 'JODI' || String(bet?.selection || '').length === 2) {
      return TEMPLATE.JODI;
    }
    if (bet?.gameTypeCodeSnapshot === 'SP_MOTOR') {
      return TEMPLATE.SP_MOTOR;
    }
    if (bet?.gameTypeCodeSnapshot === 'DP_MOTOR') {
      return TEMPLATE.DP_MOTOR;
    }
    if (
      bet?.gameTypeCodeSnapshot === 'HS_A'
      || bet?.gameTypeCodeSnapshot === 'HS_B'
      || String(bet?.selection || '').includes('_')
    ) {
      const selection = String(bet?.selection || '');
      const [left = '', right = ''] = selection.split('_');
      if (left.length === 3 && right.length === 1) {
        return TEMPLATE.HALF_SANGAM_A;
      }
      if (left.length === 1 && right.length === 3) {
        return TEMPLATE.HALF_SANGAM_B;
      }
      if (left.length === 3 && right.length === 3) {
        return TEMPLATE.FULL_SANGAM;
      }
    }
    return bet?.gameTypeCodeSnapshot || null;
  }

  static requiresFinalResult(bet) {
    const templateKey = ResultEvaluator.resolveTemplateKey(bet);
    return [
      TEMPLATE.JODI,
      TEMPLATE.HALF_SANGAM_A,
      TEMPLATE.HALF_SANGAM_B,
      TEMPLATE.FULL_SANGAM,
      'JODI',
      'HS_A',
      'HS_B',
      'FS',
    ].includes(templateKey);
  }

  static isWinningBet({ bet, result, session }) {
    const selection = canonicalizePanaSelection(bet?.selection);
    const templateKey = ResultEvaluator.resolveTemplateKey(bet);

    const openDigit = session?.result?.openDigit;
    const closeDigit = session?.result?.closeDigit;
    const resultDigit = result?.digit === null || result?.digit === undefined
      ? null
      : String(result.digit);
    const resultPana = result?.pana ? canonicalizePana(result.pana) : null;

    if (templateKey === TEMPLATE.JODI || templateKey === 'JODI') {
      if (openDigit === null || openDigit === undefined || closeDigit === null || closeDigit === undefined) {
        return false;
      }

      return selection === `${openDigit}${closeDigit}`;
    }

    if (
      templateKey === TEMPLATE.HALF_SANGAM_A
      || templateKey === TEMPLATE.HALF_SANGAM_B
      || templateKey === TEMPLATE.FULL_SANGAM
      || templateKey === 'HS_A'
      || templateKey === 'HS_B'
      || templateKey === 'FS'
    ) {
      const openPana = session?.result?.openPana ? canonicalizePana(session.result.openPana) : null;
      const closePana = session?.result?.closePana ? canonicalizePana(session.result.closePana) : null;
      const openDigit = session?.result?.openDigit;
      const derivedHalfSangam = openPana && closeDigit !== null && closeDigit !== undefined
        ? `${openPana}_${closeDigit}`
        : null;
      const derivedHalfSangamB = openDigit !== null && openDigit !== undefined && closePana
        ? `${openDigit}_${closePana}`
        : null;
      const derivedFullSangam = openPana && closePana
        ? `${openPana}_${closePana}`
        : null;

      return selection === derivedHalfSangam || selection === derivedHalfSangamB || selection === derivedFullSangam;
    }

    if (
      templateKey === TEMPLATE.SP_MOTOR
      || templateKey === TEMPLATE.DP_MOTOR
      || templateKey === 'SP_MOTOR'
      || templateKey === 'DP_MOTOR'
    ) {
      // Why: evaluate against stored snapshot, not regenerated combinations,
      // so historical bets remain immutable and auditable.
      const generatedPanas = Array.isArray(bet?.generatedPanas)
        ? bet.generatedPanas.map((pana) => canonicalizePana(pana))
        : [];
      if (!resultPana) {
        return false;
      }

      return generatedPanas.includes(resultPana);
    }

    return selection === resultDigit || selection === resultPana;
  }

  static splitWinnersAndLosers({ bets = [], result, session }) {
    const winners = [];
    const losers = [];

    for (const bet of bets) {
      if (ResultEvaluator.isWinningBet({ bet, result, session })) {
        winners.push(bet);
      } else {
        losers.push(bet);
      }
    }

    return { winners, losers };
  }
}

module.exports = ResultEvaluator;
