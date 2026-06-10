const { BET_MODE, GAME_TYPE_PHASE, SESSION_PHASE, SESSION_STATUS } = require('@config/constants/domain');
const { ValidationError } = require('@utils/errors');
const {
  canonicalizePana,
  isPanaString,
} = require('@utils/panaCanonicalization');
const { resolveMotorLineStakePaise } = require('@modules/bets/betProjection.service');
const ExposureCalculator = require('./ExposureCalculator');
const ResultEvaluator = require('./ResultEvaluator');
const { GameTypeRegistry, TEMPLATE } = require('./GameTypeRegistry');

class BettingRuleEngine {
  constructor({ nowProvider } = {}) {
    this.nowProvider = typeof nowProvider === 'function' ? nowProvider : () => new Date();
  }

  validateBet({ bet, gameType, session }) {
    if (!bet || typeof bet !== 'object') {
      throw new ValidationError('Invalid bet item');
    }
    if (!gameType || typeof gameType !== 'object') {
      throw new ValidationError('Invalid gameType');
    }

    const betMode = bet.betMode;
    if (![BET_MODE.OPEN, BET_MODE.CLOSE].includes(betMode)) {
      throw new ValidationError('Invalid betMode');
    }

    if (
      Array.isArray(gameType?.rules?.allowedBetModes)
      && gameType.rules.allowedBetModes.length > 0
      && !gameType.rules.allowedBetModes.includes(betMode)
    ) {
      throw new ValidationError('Bet mode not allowed for this game');
    }

    this.enforcePhase({ gameType, betMode });
    this.validateBetValue({ value: bet.value, rules: gameType.rules });

    if (session) {
      this.validateSessionEligibility({ session, betMode });
    }

    return true;
  }

  enforceGlobalBetLimits({ bets, globalConfig, toRupees }) {
    if (!globalConfig || !bets || !bets.length) {
      return true;
    }

    for (const bet of bets) {
      const amountInr = typeof toRupees === 'function' ? toRupees(bet.amount) : bet.amount;
      if (globalConfig.minimumBidAmount !== null && globalConfig.minimumBidAmount !== undefined && amountInr < globalConfig.minimumBidAmount) {
        throw new ValidationError(`Minimum bet amount is ${globalConfig.minimumBidAmount}`);
      }
      if (globalConfig.maximumBidAmount !== null && globalConfig.maximumBidAmount !== undefined && amountInr > globalConfig.maximumBidAmount) {
        throw new ValidationError(`Maximum bet amount is ${globalConfig.maximumBidAmount}`);
      }
    }
    return true;
  }

  enforcePhase({ gameType, betMode }) {
    const phase = gameType?.betPhaseType || GAME_TYPE_PHASE.BOTH;
    if (phase === GAME_TYPE_PHASE.OPEN_ONLY && betMode !== BET_MODE.OPEN) {
      throw new ValidationError(`${gameType?.code || 'GAME'} bets can only be placed in OPEN mode`);
    }
    if (phase === GAME_TYPE_PHASE.CLOSE_ONLY && betMode !== BET_MODE.CLOSE) {
      throw new ValidationError(`${gameType?.code || 'GAME'} bets can only be placed in CLOSE mode`);
    }
    if (!Object.values(GAME_TYPE_PHASE).includes(phase)) {
      throw new ValidationError('Invalid game type phase configuration');
    }
    return true;
  }

  calculatePayout({ bet, resultPana = null }) {
    const templateKey = ResultEvaluator.resolveTemplateKey(bet);
    const motorTemplates = new Set([
      TEMPLATE.SP_MOTOR,
      TEMPLATE.DP_MOTOR,
      'SP_MOTOR',
      'DP_MOTOR',
    ]);

    if (resultPana && motorTemplates.has(templateKey)) {
      const stake = resolveMotorLineStakePaise(bet, String(resultPana));
      return stake * Number(bet?.oddsSnapshot || 0);
    }

    const amount = bet?.stakePerCombination !== null && bet?.stakePerCombination !== undefined
      ? Number(bet.stakePerCombination || 0)
      : Number(bet?.amount || 0);
    const odds = Number(bet?.oddsSnapshot || 0);
    return amount * odds;
  }

  deriveDigitFromPana(pana) {
    const value = String(pana || '');
    if (!isPanaString(value)) {
      throw new ValidationError('Pana must be a 3-digit number string');
    }
    const digits = canonicalizePana(value).split('').map((digit) => Number(digit));
    return digits.reduce((sum, n) => sum + n, 0) % 10;
  }

  evaluateWinning({ bet, result, session }) {
    return ResultEvaluator.isWinningBet({ bet, result, session });
  }

  calculateExposure({ bets }) {
    return ExposureCalculator.calculate(bets);
  }

  calculateExposureFromSummary({ summary }) {
    return ExposureCalculator.calculateFromSummary(summary);
  }

  resolveTemplateForGameType(gameType) {
    return GameTypeRegistry.fromGameType(gameType);
  }

  validateBetValue({ value, rules }) {
    if (!rules || !Array.isArray(rules.parts) || rules.parts.length === 0) {
      throw new ValidationError('GameType rules are not configured for validation');
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ValidationError('Bet value must be an object');
    }

    for (const part of rules.parts) {
      const fieldValue = value[part.name];
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        throw new ValidationError(`Missing required part: ${part.name}`);
      }

      if (part.type === 'digit') {
        if (typeof fieldValue !== 'string') {
          throw new ValidationError(`Part ${part.name} must be a string`);
        }
        if (!this.isDigits(fieldValue, part.length)) {
          throw new ValidationError(`Part ${part.name} must be ${part.length} digit(s)`);
        }
        continue;
      }

      if (part.type === 'pana') {
        if (typeof fieldValue !== 'string') {
          throw new ValidationError(`Part ${part.name} must be a string`);
        }
        if (!this.isValidPana(fieldValue, part.panaKind || 'any')) {
          throw new ValidationError(`Part ${part.name} must be a valid ${part.panaKind || 'any'} pana`);
        }
        continue;
      }

      if (part.type === 'digit_set') {
        if (!this.isValidDigitSet(fieldValue, part.minItems || 3, part.maxItems)) {
          throw new ValidationError(`Part ${part.name} must contain unique digits (${part.minItems || 3}-${part.maxItems ?? 'any'})`);
        }
        continue;
      }

      if (part.type === 'pana_set') {
        if (!this.isValidPanaSet(fieldValue, part.minItems || 1, part.maxItems, part.panaKind || 'any')) {
          throw new ValidationError(`Part ${part.name} must contain unique ${part.panaKind || 'any'} panas (${part.minItems || 1}-${part.maxItems ?? 'any'})`);
        }
        continue;
      }

      throw new ValidationError(`Unsupported part type: ${part.type}`);
    }
  }

  validateSessionEligibility({ session, betMode }) {
    const sessionStatus = session?.status || SESSION_STATUS.ACTIVE;
    if (sessionStatus !== SESSION_STATUS.ACTIVE) {
      throw new ValidationError('Session is not active. Betting is not allowed.');
    }

    if (!session?.phase || ![SESSION_PHASE.OPEN_RUNNING, SESSION_PHASE.CLOSE_RUNNING].includes(session.phase)) {
      throw new ValidationError('Market is closed. No more bets allowed.');
    }

    const now = this.nowProvider();
    if (betMode === BET_MODE.OPEN) {
      if (session.openResultDeclared === true) {
        throw new ValidationError('Open betting has ended. Cannot place open bets after open result.');
      }
      if (session.openTime && now > new Date(session.openTime)) {
        throw new ValidationError('Open betting period has ended');
      }
      return true;
    }

    if (betMode === BET_MODE.CLOSE) {
      if (session.closeTime && now > new Date(session.closeTime)) {
        throw new ValidationError('Close betting period has ended');
      }
      return true;
    }

    throw new ValidationError('Invalid bet mode. Must be "open" or "close"');
  }

  isDigits(value, length) {
    return typeof value === 'string' && /^\d+$/.test(value) && (!length || value.length === length);
  }

  getPanaKind(value) {
    const uniqueDigits = new Set(String(value).split('')).size;
    if (uniqueDigits === 1) {
      return 'triple';
    }
    if (uniqueDigits === 2) {
      return 'double';
    }
    if (uniqueDigits === 3) {
      return 'single';
    }
    return 'unknown';
  }

  isValidPana(value, kind = 'any') {
    if (!isPanaString(value)) {
      return false;
    }
    if (kind === 'any') {
      return true;
    }
    return this.getPanaKind(canonicalizePana(value)) === kind;
  }

  isValidDigitSet(value, minItems = 3, maxItems = 7) {
    if (!Array.isArray(value)) {
      return false;
    }
    if (value.length < minItems || (maxItems !== undefined && value.length > maxItems)) {
      return false;
    }

    if (!value.every((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9)) {
      return false;
    }

    return new Set(value).size === value.length;
  }

  isValidPanaSet(value, minItems = 1, maxItems, kind = 'any') {
    if (!Array.isArray(value)) {
      return false;
    }
    if (value.length < minItems || (maxItems !== undefined && value.length > maxItems)) {
      return false;
    }

    const normalized = value.map((item) => String(item || ''));
    if (!normalized.every((item) => this.isValidPana(item, kind) && canonicalizePana(item) === item)) {
      return false;
    }

    return new Set(normalized).size === normalized.length;
  }
}

module.exports = BettingRuleEngine;
