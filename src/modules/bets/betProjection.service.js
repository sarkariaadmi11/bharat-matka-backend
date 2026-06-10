const { BET_STATUS, BET_MODE } = require('@config/constants/domain');
const { toRupees } = require('@utils');
const { canonicalizePana } = require('@utils/panaCanonicalization');
const { TEMPLATE } = require('@domain/rule-engine/GameTypeRegistry');

const MOTOR_CODES = ['SP_MOTOR', 'DP_MOTOR'];

const isMotorGameType = (gameType) => {
  const code = String(gameType?.code || '').toUpperCase();
  return [TEMPLATE.SP_MOTOR, TEMPLATE.DP_MOTOR].includes(gameType?.templateKey)
    || MOTOR_CODES.includes(code);
};

const isMotorBetRecord = (bet = {}, gameType = null) => {
  const snapshotCode = String(bet?.gameTypeCodeSnapshot || '').toUpperCase();
  const snapshotTemplate = String(bet?.gameTypeTemplateKey || '').toUpperCase();
  const resolvedCode = String(gameType?.code || '').toUpperCase();

  return [snapshotCode, snapshotTemplate, resolvedCode].some((value) => MOTOR_CODES.includes(value));
};

const buildMotorSnapshot = (bet, selection) => {
  const generatedPanas = String(selection || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    generatedPanas,
    combinationCount: generatedPanas.length,
    stakePerCombination: generatedPanas.length ? bet.amount / generatedPanas.length : null,
  };
};

const extractMotorPanas = (bet = {}) => {
  if (Array.isArray(bet.generatedPanas) && bet.generatedPanas.length > 0) {
    return bet.generatedPanas;
  }

  return String(bet.selection || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const motorLineStakesToObject = (bet = {}) => {
  const raw = bet?.motorLineStakesPaise;
  if (!raw) {
    return null;
  }

  if (raw instanceof Map) {
    return Object.fromEntries(raw);
  }

  if (typeof raw === 'object') {
    return { ...raw };
  }

  return null;
};

const resolveMotorRowAmount = (bet = {}) => {
  const generatedPanas = extractMotorPanas(bet);
  if (!generatedPanas.length) {
    return Number(bet.amount || 0);
  }

  if (bet.stakePerCombination !== null && bet.stakePerCombination !== undefined) {
    return Number(bet.stakePerCombination || 0);
  }

  return Number(bet.amount || 0) / generatedPanas.length;
};

const resolveMotorLineStakePaise = (bet = {}, pana) => {
  if (pana === undefined || pana === null || String(pana).trim() === '') {
    return resolveMotorRowAmount(bet);
  }

  const key = canonicalizePana(String(pana));
  const stakes = motorLineStakesToObject(bet);
  if (stakes && Object.prototype.hasOwnProperty.call(stakes, key)) {
    return Number(stakes[key] || 0);
  }

  return resolveMotorRowAmount(bet);
};

const buildExpandedBetId = (betId, expansionKey) => {
  if (!expansionKey) {
    return String(betId);
  }

  return `${betId}_${expansionKey}`;
};

const parseExpandedBetReference = (reference) => {
  const raw = String(reference || '').trim();
  if (!raw) {
    return {
      storedBetId: null,
      expansionKey: null,
      isExpanded: false,
      raw,
    };
  }

  const underscoreIndex = raw.indexOf('_');
  if (underscoreIndex === -1) {
    return {
      storedBetId: raw,
      expansionKey: null,
      isExpanded: false,
      raw,
    };
  }

  return {
    storedBetId: raw.slice(0, underscoreIndex),
    expansionKey: raw.slice(underscoreIndex + 1),
    isExpanded: true,
    raw,
  };
};

const getMotorHistoryOutcome = ({ bet, session, pana }) => {
  const resultPana = bet.betMode === BET_MODE.OPEN
    ? session?.result?.openPana
    : session?.result?.closePana;
  const normalizedResultPana = resultPana ? canonicalizePana(String(resultPana)) : null;
  const normalizedLine = canonicalizePana(String(pana));

  if (bet.status === BET_STATUS.WON) {
    const isWinningPana = normalizedResultPana === normalizedLine;
    return {
      status: isWinningPana ? BET_STATUS.WON : BET_STATUS.LOST,
      payout: isWinningPana ? bet.payout || 0 : 0,
    };
  }

  return {
    status: bet.status,
    payout: bet.payout || 0,
  };
};

const buildBaseProjectedBet = ({ bet, market, gameType }) => ({
  id: String(bet._id),
  betId: String(bet._id),
  expansionKey: null,
  isExpanded: false,
  market: market?.code || null,
  gameType: gameType?.code || null,
  betMode: bet.betMode,
  selection: bet.selection,
  amount: toRupees(bet.amount),
  totalAmount: toRupees(bet.amount),
  odds: bet.oddsSnapshot,
  status: bet.status,
  payout: toRupees(bet.payout || 0),
  totalPayout: toRupees(bet.payout || 0),
  placedAt: bet.createdAt,
});

const expandHistoryBetItems = ({
  bet,
  market,
  gameType,
  session,
}) => {
  if (bet.status === BET_STATUS.CANCELLED) {
    return [];
  }

  const baseItem = buildBaseProjectedBet({ bet, market, gameType });

  if (!isMotorBetRecord(bet, gameType)) {
    return [baseItem];
  }

  const panas = extractMotorPanas(bet);
  if (!panas.length) {
    return [baseItem];
  }

  return panas.map((pana) => {
    const canonical = canonicalizePana(String(pana));
    const lineStakePaise = resolveMotorLineStakePaise(bet, canonical);
    const outcome = getMotorHistoryOutcome({ bet, session, pana: canonical });
    const linePayoutRupees = toRupees(outcome.payout);

    return {
      ...baseItem,
      id: buildExpandedBetId(bet._id, canonical),
      selection: canonical,
      amount: toRupees(lineStakePaise),
      payout: linePayoutRupees,
      totalPayout: linePayoutRupees,
      status: outcome.status,
      expansionKey: canonical,
      isExpanded: true,
    };
  });
};

const computeMotorLineRemoval = (betPlain, expansionKey) => {
  const key = canonicalizePana(String(expansionKey || '').trim());
  const panas = extractMotorPanas(betPlain).map((p) => canonicalizePana(String(p)));

  if (!key || !panas.includes(key)) {
    return null;
  }

  const refundPaise = resolveMotorLineStakePaise(betPlain, key);
  const nextPanas = panas.filter((p) => p !== key);

  if (!nextPanas.length) {
    return {
      cancelEntireBet: true,
      refundPaise: Number(betPlain.amount || 0),
      nextPlain: null,
    };
  }

  const stakes = motorLineStakesToObject(betPlain);
  let nextStakes = null;

  if (stakes) {
    nextStakes = { ...stakes };
    delete nextStakes[key];
  }

  const nextAmount = Number(betPlain.amount || 0) - refundPaise;
  let stakePerCombination = null;

  if (!nextStakes) {
    stakePerCombination = nextAmount / nextPanas.length;
  }

  return {
    cancelEntireBet: false,
    refundPaise,
    nextPlain: {
      ...betPlain,
      selection: nextPanas.join(','),
      generatedPanas: nextPanas,
      combinationCount: nextPanas.length,
      amount: nextAmount,
      motorLineStakesPaise: nextStakes,
      stakePerCombination: nextStakes ? null : stakePerCombination,
    },
  };
};

const expandWinnerPreviewItems = ({
  bet,
  market,
  gameType,
  resultPana,
  betPayoutPaise,
  user,
  sessionLabel,
}) => {
  if (bet.status === BET_STATUS.CANCELLED) {
    return [];
  }

  const betId = String(bet._id);
  const normalizedResultPana = String(resultPana || '').trim()
    ? canonicalizePana(String(resultPana).trim())
    : null;

  const buildBase = (overrides = {}) => ({
    id: betId,
    betId,
    expansionKey: null,
    isExpanded: false,
    userId: bet.userId,
    username: user?.username || user?.email || 'N/A',
    selection: bet.selection,
    gameType: bet.gameTypeCodeSnapshot || gameType?.code || 'UNKNOWN',
    market: market?.code || market?.name || 'N/A',
    session: sessionLabel,
    betAmount: toRupees(bet.amount),
    totalAmount: toRupees(bet.amount),
    createdAt: bet.createdAt,
    motorLineHit: null,
    ...overrides,
  });

  if (!isMotorBetRecord(bet, gameType)) {
    const payoutRupees = toRupees(Number(betPayoutPaise || 0));
    return [buildBase({
      payout: payoutRupees,
      totalPayout: payoutRupees,
    })];
  }

  const panas = extractMotorPanas(bet).map((p) => canonicalizePana(String(p)));
  if (!panas.length) {
    const payoutRupees = toRupees(0);
    return [buildBase({ payout: payoutRupees, totalPayout: payoutRupees })];
  }

  if (!normalizedResultPana) {
    const payoutRupees = toRupees(0);
    return [buildBase({ payout: payoutRupees, totalPayout: payoutRupees })];
  }

  return panas.filter((pana) => pana === normalizedResultPana).map((pana) => {
    const lineStakePaise = resolveMotorLineStakePaise(bet, pana);
    const linePayoutPaise = lineStakePaise * Number(bet.oddsSnapshot || 0);
    const payoutRupees = toRupees(linePayoutPaise);

    return {
      ...buildBase({
        id: buildExpandedBetId(bet._id, pana),
        betId,
        selection: pana,
        betAmount: toRupees(lineStakePaise),
        totalAmount: toRupees(bet.amount),
        payout: payoutRupees,
        totalPayout: payoutRupees,
        expansionKey: pana,
        isExpanded: true,
        motorLineHit: true,
      }),
    };
  });
};

module.exports = {
  isMotorGameType,
  isMotorBetRecord,
  buildMotorSnapshot,
  extractMotorPanas,
  resolveMotorRowAmount,
  resolveMotorLineStakePaise,
  motorLineStakesToObject,
  computeMotorLineRemoval,
  buildExpandedBetId,
  parseExpandedBetReference,
  expandHistoryBetItems,
  expandWinnerPreviewItems,
};
