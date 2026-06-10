const { DateTime } = require('luxon');
const config = require('@config');
const logger = require('@utils/logger');
const { toRupees } = require('@utils');
const { NotFoundError } = require('@utils/errors');
const { ResultEvaluator } = require('@domain/rule-engine');
const { RepositoryFactory } = require('@infra/database');
const { BUSINESS_TIMEZONE } = require('@utils/timezoneHelper');

const adminAnalyticsRepository = RepositoryFactory.getRepository('AdminAnalytics');
const gameSessionRepository = RepositoryFactory.getRepository('GameSession');

const dashboardCache = new Map();

const toSessionDate = (date) => DateTime.fromJSDate(date, { zone: BUSINESS_TIMEZONE }).toISODate();

const buildSort = (sortBy, order, allowed) => ({
  [allowed[sortBy] || Object.values(allowed)[0]]: order === 'asc' ? 1 : -1,
});

const paginate = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit) || 1,
});

const buildSessionTruth = (session) => ({
  sessionId: String(session._id),
  sessionDate: toSessionDate(session.sessionDate),
  marketId: String(session.marketId),
  currentResult: session.currentResult || null,
  settledResult: session.settledResult || null,
  isFinanciallyConsistent: session.isFinanciallyConsistent !== false,
  warning: session.warning || null,
  settlementStatus: session.settlementStatus || null,
});

const buildRangeSessionIds = async ({ sessionDate, marketId, fromDate, toDate }) => {
  if (sessionDate) {
    if (marketId) {
      const session = await gameSessionRepository.findByMarketAndDateLean(marketId, sessionDate);
      return session ? [String(session._id)] : [];
    }

    const day = normalizeRange({ fromDate: sessionDate, toDate: sessionDate });
    return gameSessionRepository.findSessionIdsByDateRange(day);
  }

  const range = normalizeRange({ fromDate, toDate });
  return gameSessionRepository.findSessionIdsByDateRange({
    ...range,
    marketId,
  });
};

const normalizeRange = ({ fromDate, toDate }) => {
  if (fromDate && toDate) {
    const start = DateTime.fromISO(fromDate, { zone: BUSINESS_TIMEZONE }).startOf('day');
    const end = DateTime.fromISO(toDate, { zone: BUSINESS_TIMEZONE }).endOf('day');
    return { from: start.toJSDate(), to: end.toJSDate() };
  }

  const end = DateTime.now().setZone(BUSINESS_TIMEZONE).endOf('day');
  const start = end.minus({ days: config.ANALYTICS_DEFAULT_RANGE_DAYS - 1 }).startOf('day');
  return { from: start.toJSDate(), to: end.toJSDate() };
};

const buildTruthModel = (extra = {}) => ({
  displayTruth: 'currentResult',
  financialTruth: 'transactions',
  ...extra,
});

const getDashboardSummary = async ({ businessDate }) => {
  const cacheKey = businessDate;
  const ttlSeconds = config.ANALYTICS_DASHBOARD_CACHE_TTL_SECONDS;
  const cached = dashboardCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    logger.debug({ message: 'Admin analytics dashboard cache hit', module: 'admin-analytics', cacheKey });
    return {
      data: cached.payload,
      meta: {
        cache: { hit: true, ttlSeconds },
        truthModel: buildTruthModel(),
      },
    };
  }

  logger.debug({ message: 'Admin analytics dashboard cache miss', module: 'admin-analytics', cacheKey });
  const summary = await adminAnalyticsRepository.getDashboardSummary({ businessDate });
  const payload = {
    users: summary.users,
    markets: summary.markets,
    sessions: summary.sessions,
    finance: {
      totalBidAmountToday: toRupees(summary.finance.totalBidAmount),
      totalWinningAmountToday: toRupees(summary.finance.totalWinningAmount),
      netProfitToday: toRupees(summary.finance.totalBidAmount - summary.finance.totalWinningAmount),
    },
  };

  dashboardCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  return {
    data: payload,
    meta: {
      cache: { hit: false, ttlSeconds },
      truthModel: buildTruthModel(),
    },
  };
};

const requireSession = async ({ marketId, sessionDate }) => {
  const session = await gameSessionRepository.findByMarketAndDateLean(marketId, sessionDate);
  if (!session) {
    throw new NotFoundError('Session not found', [`No session exists for market ${marketId} on ${sessionDate}`]);
  }
  return session;
};

const getMarketDigitSummary = async ({ marketId, sessionDate, phase }) => {
  const session = await requireSession({ marketId, sessionDate });
  const rows = await adminAnalyticsRepository.getMarketDigitSummary({ sessionId: session._id, phase });

  const rowMap = new Map(rows.map((row) => [String(row.digit), row]));
  const items = Array.from({ length: 10 }, (_, digit) => {
    const value = rowMap.get(String(digit));
    return {
      digit: String(digit),
      totalBets: Number(value?.totalBets || 0),
      totalAmount: toRupees(Number(value?.totalAmount || 0)),
      totalPlayers: Number(value?.totalPlayers || 0),
    };
  });

  return {
    data: {
      ...buildSessionTruth(session),
      items,
    },
    meta: {
      truthModel: buildTruthModel(),
    },
  };
};

const getMarketBidSummary = async ({ marketId, sessionDate }) => {
  const session = await requireSession({ marketId, sessionDate });
  const summary = await adminAnalyticsRepository.getMarketBidSummary({ sessionId: session._id }) || {};

  return {
    data: {
      ...buildSessionTruth(session),
      totalBets: Number(summary.totalBets || 0),
      totalAmount: toRupees(Number(summary.totalAmount || 0)),
      totalPlayers: Number(summary.totalPlayers || 0),
      openAmount: toRupees(Number(summary.openAmount || 0)),
      closeAmount: toRupees(Number(summary.closeAmount || 0)),
    },
    meta: {
      truthModel: buildTruthModel(),
    },
  };
};

const attachConsistencyWarningLogs = (items, endpoint) => {
  const inconsistent = items.filter((item) => item.isFinanciallyConsistent === false);
  if (inconsistent.length > 0) {
    logger.warn({
      message: 'Analytics response includes financially inconsistent sessions',
      module: 'admin-analytics',
      endpoint,
      sessionIds: inconsistent.map((item) => String(item.sessionId)),
    });
  }
};

const getProfitLossReport = async (query) => {
  const sessionIds = await buildRangeSessionIds(query);
  const sort = buildSort(query.sortBy, query.order, {
    sessionDate: 'sessionDate',
    totalCollection: 'totalCollection',
    totalPayout: 'totalPayout',
    netProfit: 'netProfit',
  });

  const result = await adminAnalyticsRepository.getProfitLossReport({
    sessionIds,
    page: query.page,
    limit: query.limit,
    sort,
  });

  const items = result.items.map((item) => ({
    ...item,
    sessionId: String(item.sessionId),
    marketId: String(item.marketId),
    sessionDate: toSessionDate(item.sessionDate),
    totalCollection: toRupees(item.totalCollection),
    totalPayout: toRupees(item.totalPayout),
    netProfit: toRupees(item.netProfit),
  }));

  attachConsistencyWarningLogs(items, 'profit-loss');

  return {
    data: items,
    pagination: paginate({ page: query.page, limit: query.limit, total: result.total }),
    meta: {
      truthModel: buildTruthModel(),
    },
  };
};

const getBidReport = async (query) => {
  const sessionIds = await buildRangeSessionIds(query);
  const sort = buildSort(query.sortBy, query.order, {
    createdAt: 'createdAt',
    betAmount: 'betAmount',
    status: 'status',
    selection: 'selection',
    username: 'username',
  });

  const result = await adminAnalyticsRepository.getBidReport({
    ...query,
    sessionIds,
    sort,
  });

  const items = result.items.map((item) => ({
    ...item,
    betId: String(item.betId),
    userId: String(item.userId),
    marketId: String(item.marketId),
    sessionId: String(item.sessionId),
    gameTypeId: String(item.gameTypeId),
    sessionDate: toSessionDate(item.sessionDate),
    betAmount: toRupees(item.betAmount),
    sessionTruth: {
      currentResult: item.currentResult,
      settledResult: item.settledResult,
      isFinanciallyConsistent: item.isFinanciallyConsistent !== false,
      warning: item.warning || null,
    },
  }));

  const sessionTruths = [...new Map(items.map((item) => [item.sessionId, item.sessionTruth])).values()];
  attachConsistencyWarningLogs(items, 'bids');

  const data = {
    items,
    summary: {
      totalBets: result.summary.totalBets,
      totalAmount: toRupees(result.summary.totalAmount),
      totalPlayers: result.summary.totalPlayers,
    },
  };

  if (sessionTruths.length === 1) {
    Object.assign(data, sessionTruths[0]);
  } else if (sessionTruths.length > 1) {
    data.truthScope = 'multi-session';
    data.truthNote = 'Session truth varies across rows. Inspect each item.sessionTruth.';
  }

  return {
    data,
    pagination: paginate({ page: query.page, limit: query.limit, total: result.total }),
    meta: {
      truthModel: buildTruthModel(),
    },
  };
};

const toDisplayResult = (row) => {
  if (row.phase === 'open') {
    if (row.currentResult?.openDigit === null || row.currentResult?.openDigit === undefined) {
      return null;
    }

    return `${row.currentResult?.openPana || ''}-${row.currentResult.openDigit}`;
  }

  if (row.currentResult?.closeDigit === null || row.currentResult?.closeDigit === undefined) {
    return null;
  }

  return `${row.currentResult?.closePana || ''}-${row.currentResult.closeDigit}`;
};

const getWinningHistory = async (query) => {
  const sessionIds = await buildRangeSessionIds(query);
  const sort = buildSort(query.sortBy, query.order, {
    createdAt: 'createdAt',
    betAmount: 'betAmount',
    recordedPayout: 'payout',
    username: 'username',
  });

  const result = await adminAnalyticsRepository.getWinningHistoryCandidates({
    sessionIds,
    marketId: query.marketId,
    page: query.page,
    limit: query.limit,
    sort,
  });

  const filtered = result.items
    .filter((row) => (!query.gameType || row.gameTypeCode === String(query.gameType).toUpperCase()))
    .filter((row) => (!query.phase || row.phase === query.phase))
    .filter((row) => ResultEvaluator.isWinningBet({
      bet: {
        selection: row.selection,
        betMode: row.phase,
        gameTypeId: row.gameTypeId,
        gameTypeCodeSnapshot: row.gameTypeCode,
      },
      result: row.phase === 'open'
        ? { pana: row.currentResult?.openPana, digit: row.currentResult?.openDigit }
        : { pana: row.currentResult?.closePana, digit: row.currentResult?.closeDigit },
      session: { result: row.currentResult || {} },
    }))
    .map((row) => ({
      betId: String(row.betId),
      userId: String(row.userId),
      username: row.username,
      marketId: String(row.marketId),
      marketName: row.marketName,
      sessionId: String(row.sessionId),
      sessionDate: toSessionDate(row.sessionDate),
      gameTypeId: String(row.gameTypeId),
      gameTypeCode: row.gameTypeCode,
      gameTypeName: row.gameTypeName,
      phase: row.phase,
      selection: row.selection,
      betAmount: toRupees(row.betAmount),
      displayResult: toDisplayResult(row),
      statusByCurrentResult: 'won',
      recordedPayout: toRupees(row.payout || 0),
      declaredAt: row.phase === 'open'
        ? row.currentResult?.openDeclaredAt || null
        : row.currentResult?.closeDeclaredAt || null,
      createdAt: row.createdAt,
      sessionTruth: {
        currentResult: row.currentResult,
        settledResult: row.settledResult,
        isFinanciallyConsistent: row.isFinanciallyConsistent !== false,
        warning: row.warning || null,
      },
    }));

  attachConsistencyWarningLogs(filtered, 'winning-history');

  return {
    data: filtered,
    pagination: paginate({ page: query.page, limit: query.limit, total: filtered.length }),
    meta: {
      truthModel: buildTruthModel({
        resultSettlementTruth: 'settledResult',
      }),
      disclaimer: 'Winning history is display truth from currentResult and can diverge from ledger truth after result reset.',
    },
  };
};

const getAdminDepositHistory = async (query) => {
  const filter = { transactionType: 'deposit' };
  if (query.status) {
    filter.status = query.status;
  }
  if (query.provider) {
    filter.provider = query.provider;
  }
  if (query.userId) {
    filter.userId = query.userId;
  }

  if (query.fromDate && query.toDate) {
    const range = normalizeRange({ fromDate: query.fromDate, toDate: query.toDate });
    filter.createdAt = { $gte: range.from, $lte: range.to };
  }

  const sort = buildSort(query.sortBy, query.order, {
    createdAt: 'createdAt',
    amount: 'amount',
    updatedAt: 'updatedAt',
    creditedAt: 'creditedAt',
  });

  const result = await adminAnalyticsRepository.getAdminDepositHistory({
    filter,
    page: query.page,
    limit: query.limit,
    sort,
  });

  const statusBreakdown = result.statusSummary.reduce((acc, row) => {
    acc[row._id] = Number(row.totalRequests || 0);
    return acc;
  }, {});

  const totalRequests = result.statusSummary.reduce((sum, row) => sum + Number(row.totalRequests || 0), 0);
  const totalRequestedAmount = result.statusSummary.reduce((sum, row) => sum + Number(row.totalRequestedAmount || 0), 0);
  const totalCreditedAmount = result.statusSummary.reduce((sum, row) => sum + Number(row.totalCreditedAmount || 0), 0);

  return {
    data: {
      items: result.items.map((item) => ({
        ...item,
        depositId: String(item.depositId),
        userId: String(item.userId),
        amount: toRupees(item.amount),
      })),
      summary: {
        totalRequests,
        totalRequestedAmount: toRupees(totalRequestedAmount),
        totalCreditedAmount: toRupees(totalCreditedAmount),
        statusBreakdown,
      },
    },
    pagination: paginate({ page: query.page, limit: query.limit, total: result.total }),
    meta: {
      truthModel: {
        requestTruth: 'payments',
        financialTruth: 'transactions',
      },
    },
  };
};

module.exports = {
  getDashboardSummary,
  getMarketDigitSummary,
  getMarketBidSummary,
  getProfitLossReport,
  getBidReport,
  getWinningHistory,
  getAdminDepositHistory,
  normalizeRange,
  buildSessionTruth,
};
