const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const { Bet, GameSession, Market, Payment, Transaction, User } = require('@infra/models');
const { TRANSACTION_TYPE } = require('@config/constants/domain');
const { BUSINESS_TIMEZONE } = require('@utils/timezoneHelper');

const toObjectId = (value) => (value instanceof mongoose.Types.ObjectId
  ? value
  : new mongoose.Types.ObjectId(value));

const buildDayRange = (sessionDate) => {
  const start = DateTime.fromISO(sessionDate, { zone: BUSINESS_TIMEZONE }).startOf('day');
  return {
    start: start.toJSDate(),
    end: start.endOf('day').toJSDate(),
  };
};

class AdminAnalyticsRepository {
  async getDashboardSummary({ businessDate }) {
    const { start, end } = buildDayRange(businessDate);

    const [
      totalUsers,
      approvedUsers,
      totalMarkets,
      sessionsToday,
      bidTotals,
      payoutTotals,
    ] = await Promise.all([
      User.countDocuments({ deletedAt: null }),
      User.countDocuments({ deletedAt: null, isVerified: true }),
      Market.countDocuments({ status: 'active' }),
      GameSession.countDocuments({ sessionDate: { $gte: start, $lte: end } }),
      Bet.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, totalBidAmount: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        {
          $match: {
            type: TRANSACTION_TYPE.WIN_CREDIT,
            createdAt: { $gte: start, $lte: end },
          },
        },
        { $group: { _id: null, totalWinningAmount: { $sum: '$amount' } } },
      ]),
    ]);

    return {
      users: {
        total: totalUsers,
        approved: approvedUsers,
        unapproved: Math.max(totalUsers - approvedUsers, 0),
      },
      markets: {
        total: totalMarkets,
      },
      sessions: {
        today: sessionsToday,
      },
      finance: {
        totalBidAmount: Number(bidTotals[0]?.totalBidAmount || 0),
        totalWinningAmount: Number(payoutTotals[0]?.totalWinningAmount || 0),
      },
    };
  }

  async getMarketDigitSummary({ sessionId, phase }) {
    const rows = await Bet.aggregate([
      {
        $match: {
          sessionId: toObjectId(sessionId),
          betMode: phase,
          selection: { $regex: '^[0-9]$' },
        },
      },
      {
        $group: {
          _id: '$selection',
          totalBets: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          players: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          _id: 0,
          digit: '$_id',
          totalBets: 1,
          totalAmount: 1,
          totalPlayers: { $size: '$players' },
        },
      },
    ]);

    return rows;
  }

  async getMarketBidSummary({ sessionId }) {
    const [summary = null] = await Bet.aggregate([
      {
        $match: {
          sessionId: toObjectId(sessionId),
        },
      },
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          players: { $addToSet: '$userId' },
          openAmount: {
            $sum: {
              $cond: [{ $eq: ['$betMode', 'open'] }, '$amount', 0],
            },
          },
          closeAmount: {
            $sum: {
              $cond: [{ $eq: ['$betMode', 'close'] }, '$amount', 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalBets: 1,
          totalAmount: 1,
          totalPlayers: { $size: '$players' },
          openAmount: 1,
          closeAmount: 1,
        },
      },
    ]);

    return summary;
  }

  async getProfitLossReport({
    sessionIds = [],
    page,
    limit,
    sort,
  }) {
    const match = sessionIds.length > 0
      ? { _id: { $in: sessionIds.map(toObjectId) } }
      : {};

    const [result = {}] = await GameSession.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'markets',
          localField: 'marketId',
          foreignField: '_id',
          as: 'market',
        },
      },
      { $unwind: '$market' },
      {
        $lookup: {
          from: 'bets',
          let: { sessionId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$sessionId', '$$sessionId'] } } },
            { $group: { _id: null, totalCollection: { $sum: '$amount' } } },
          ],
          as: 'betSummary',
        },
      },
      {
        $lookup: {
          from: 'transactions',
          let: { sessionId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$sessionId', '$$sessionId'] },
                type: TRANSACTION_TYPE.WIN_CREDIT,
              },
            },
            { $group: { _id: null, totalPayout: { $sum: '$amount' } } },
          ],
          as: 'transactionSummary',
        },
      },
      {
        $addFields: {
          totalCollection: { $ifNull: [{ $first: '$betSummary.totalCollection' }, 0] },
          totalPayout: { $ifNull: [{ $first: '$transactionSummary.totalPayout' }, 0] },
        },
      },
      {
        $addFields: {
          netProfit: { $subtract: ['$totalCollection', '$totalPayout'] },
        },
      },
      {
        $project: {
          _id: 0,
          sessionId: '$_id',
          marketId: '$market._id',
          marketName: '$market.name',
          sessionDate: 1,
          totalCollection: 1,
          totalPayout: 1,
          netProfit: 1,
          currentResult: 1,
          settledResult: 1,
          isFinanciallyConsistent: 1,
          warning: 1,
          settlementStatus: 1,
        },
      },
      {
        $facet: {
          items: [
            { $sort: sort },
            { $skip: (page - 1) * limit },
            { $limit: limit },
          ],
          meta: [{ $count: 'total' }],
        },
      },
    ]);

    return {
      items: result.items || [],
      total: Number(result.meta?.[0]?.total || 0),
    };
  }

  async getBidReport({
    sessionIds = [],
    marketId,
    gameType,
    userId,
    status,
    search,
    page,
    limit,
    sort,
  }) {
    const match = {};
    if (sessionIds.length > 0) {
      match.sessionId = { $in: sessionIds.map(toObjectId) };
    }
    if (userId) {
      match.userId = toObjectId(userId);
    }
    if (status) {
      match.status = status;
    }
    if (gameType && mongoose.Types.ObjectId.isValid(gameType)) {
      match.gameTypeId = toObjectId(gameType);
    }

    const marketMatch = marketId ? [{ $match: { 'market._id': toObjectId(marketId) } }] : [];
    const gameTypeMatch = gameType && !mongoose.Types.ObjectId.isValid(gameType)
      ? [{ $match: { 'gameType.code': String(gameType).toUpperCase() } }]
      : [];
    const searchMatch = search
      ? [{
        $match: {
          $or: [
            { 'user.username': { $regex: search, $options: 'i' } },
            { 'user.phone': { $regex: search, $options: 'i' } },
            { $expr: { $regexMatch: { input: { $toString: '$user._id' }, regex: search, options: 'i' } } },
          ],
        },
      }]
      : [];

    const [result = {}] = await Bet.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'gamesessions',
          localField: 'sessionId',
          foreignField: '_id',
          as: 'session',
        },
      },
      { $unwind: '$session' },
      {
        $lookup: {
          from: 'markets',
          localField: 'session.marketId',
          foreignField: '_id',
          as: 'market',
        },
      },
      { $unwind: '$market' },
      ...marketMatch,
      {
        $lookup: {
          from: 'gametypes',
          localField: 'gameTypeId',
          foreignField: '_id',
          as: 'gameType',
        },
      },
      { $unwind: '$gameType' },
      ...gameTypeMatch,
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      ...searchMatch,
      {
        $project: {
          _id: 0,
          betId: '$_id',
          userId: '$user._id',
          username: '$user.username',
          marketId: '$market._id',
          marketName: '$market.name',
          sessionId: '$session._id',
          sessionDate: '$session.sessionDate',
          gameTypeId: '$gameType._id',
          gameTypeCode: '$gameType.code',
          gameTypeName: '$gameType.name',
          phase: '$betMode',
          selection: 1,
          betAmount: '$amount',
          status: 1,
          createdAt: 1,
          currentResult: '$session.currentResult',
          settledResult: '$session.settledResult',
          isFinanciallyConsistent: '$session.isFinanciallyConsistent',
          warning: '$session.warning',
        },
      },
      {
        $facet: {
          items: [
            { $sort: sort },
            { $skip: (page - 1) * limit },
            { $limit: limit },
          ],
          meta: [{ $count: 'total' }],
          summary: [
            {
              $group: {
                _id: null,
                totalBets: { $sum: 1 },
                totalAmount: { $sum: '$betAmount' },
                players: { $addToSet: '$userId' },
              },
            },
            {
              $project: {
                _id: 0,
                totalBets: 1,
                totalAmount: 1,
                totalPlayers: { $size: '$players' },
              },
            },
          ],
        },
      },
    ]);

    return {
      items: result.items || [],
      total: Number(result.meta?.[0]?.total || 0),
      summary: result.summary?.[0] || {
        totalBets: 0,
        totalAmount: 0,
        totalPlayers: 0,
      },
    };
  }

  async getWinningHistoryCandidates({
    sessionIds = [],
    marketId,
    page,
    limit,
    sort,
  }) {
    const match = {};
    if (sessionIds.length > 0) {
      match.sessionId = { $in: sessionIds.map(toObjectId) };
    }

    const marketMatch = marketId ? [{ $match: { 'market._id': toObjectId(marketId) } }] : [];

    const [result = {}] = await Bet.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'gamesessions',
          localField: 'sessionId',
          foreignField: '_id',
          as: 'session',
        },
      },
      { $unwind: '$session' },
      {
        $lookup: {
          from: 'markets',
          localField: 'session.marketId',
          foreignField: '_id',
          as: 'market',
        },
      },
      { $unwind: '$market' },
      ...marketMatch,
      {
        $lookup: {
          from: 'gametypes',
          localField: 'gameTypeId',
          foreignField: '_id',
          as: 'gameType',
        },
      },
      { $unwind: '$gameType' },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          betId: '$_id',
          userId: '$user._id',
          username: '$user.username',
          marketId: '$market._id',
          marketName: '$market.name',
          sessionId: '$session._id',
          sessionDate: '$session.sessionDate',
          gameTypeId: '$gameType._id',
          gameTypeCode: '$gameType.code',
          gameTypeName: '$gameType.name',
          phase: '$betMode',
          selection: 1,
          betAmount: '$amount',
          payout: '$payout',
          createdAt: 1,
          currentResult: '$session.currentResult',
          settledResult: '$session.settledResult',
          isFinanciallyConsistent: '$session.isFinanciallyConsistent',
          warning: '$session.warning',
        },
      },
      {
        $facet: {
          items: [
            { $sort: sort },
            { $skip: (page - 1) * limit },
            { $limit: limit },
          ],
          meta: [{ $count: 'total' }],
        },
      },
    ]);

    return {
      items: result.items || [],
      total: Number(result.meta?.[0]?.total || 0),
    };
  }

  async getAdminDepositHistory({
    filter,
    page,
    limit,
    sort,
  }) {
    const [result = {}] = await Payment.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 0,
          depositId: '$_id',
          userId: '$user._id',
          username: '$user.username',
          provider: 1,
          amount: 1,
          status: 1,
          verificationStatus: 1,
          referenceId: 1,
          paymentReference: 1,
          createdAt: 1,
          updatedAt: 1,
          creditedAt: 1,
          failedAt: 1,
        },
      },
      {
        $facet: {
          items: [
            { $sort: sort },
            { $skip: (page - 1) * limit },
            { $limit: limit },
          ],
          meta: [{ $count: 'total' }],
          summary: [
            {
              $group: {
                _id: '$status',
                totalRequests: { $sum: 1 },
                totalRequestedAmount: { $sum: '$amount' },
                totalCreditedAmount: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'success'] }, '$amount', 0],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    return {
      items: result.items || [],
      total: Number(result.meta?.[0]?.total || 0),
      statusSummary: result.summary || [],
    };
  }
}

module.exports = AdminAnalyticsRepository;
