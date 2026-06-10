const gameSessionService = require('../modules/sessions/sessions.service');
const { ValidationError } = require('@utils/errors');
const { BET_MODE, GAME_TYPE_PHASE } = require('@config/constants/domain');
const { validateBetValue } = require('@utils/betValueValidator');

const VALID_BET_MODES = [BET_MODE.OPEN, BET_MODE.CLOSE];

const enforceGameTypePhase = (gameType, betMode) => {
  const betPhaseType = gameType?.betPhaseType || GAME_TYPE_PHASE.BOTH;
  const gameTypeCode = gameType?.code || 'GAME';

  if (betPhaseType === GAME_TYPE_PHASE.OPEN_ONLY && betMode !== BET_MODE.OPEN) {
    throw new ValidationError(`${gameTypeCode} bets can only be placed in OPEN mode`);
  }

  if (betPhaseType === GAME_TYPE_PHASE.CLOSE_ONLY && betMode !== BET_MODE.CLOSE) {
    throw new ValidationError(`${gameTypeCode} bets can only be placed in CLOSE mode`);
  }

  if (!Object.values(GAME_TYPE_PHASE).includes(betPhaseType)) {
    throw new ValidationError('Invalid game type phase configuration');
  }
};

const validateBetItem = (bet, gameType, gameSession) => {
  if (!bet || typeof bet !== 'object') {
    throw new ValidationError('Invalid bet item');
  }

  if (typeof bet.amount === 'undefined') {
    throw new ValidationError('Invalid bet item');
  }

  if (!bet.betMode) {
    throw new ValidationError('Invalid bet item');
  }

  if (!VALID_BET_MODES.includes(bet.betMode)) {
    throw new ValidationError('Invalid betMode');
  }

  if (
    Array.isArray(gameType?.rules?.allowedBetModes)
    && gameType.rules.allowedBetModes.length > 0
    && !gameType.rules.allowedBetModes.includes(bet.betMode)
  ) {
    throw new ValidationError('Bet mode not allowed for this game');
  }

  enforceGameTypePhase(gameType, bet.betMode);
  validateBetValue(bet.value, gameType?.rules);
  gameSessionService.validateBettingEligibility(gameSession, bet.betMode);
};

module.exports = {
  validateBetItem,
  enforceGameTypePhase,
};
