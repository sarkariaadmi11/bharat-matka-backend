module.exports = {
  tags: [
    {
      name: 'Admin Analytics',
      description: 'Read-only admin analytics and reporting endpoints with explicit truth metadata.',
    },
  ],
  paths: {
    '/admin/analytics/dashboard/summary': {
      get: {
        summary: 'Get admin dashboard summary',
        tags: ['Admin Analytics'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Dashboard summary retrieved',
          },
        },
      },
    },
    '/admin/analytics/markets/{marketId}/digits': {
      get: {
        summary: 'Get market digit summary for a session phase',
        tags: ['Admin Analytics'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'marketId', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'sessionDate', required: true, schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'phase', required: true, schema: { type: 'string', enum: ['open', 'close'] } },
        ],
        responses: {
          200: {
            description: 'Market digit summary retrieved',
          },
        },
      },
    },
    '/admin/analytics/markets/{marketId}/bids': {
      get: {
        summary: 'Get market bid activity summary for a session',
        tags: ['Admin Analytics'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'marketId', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'sessionDate', required: true, schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: {
            description: 'Market bid summary retrieved',
          },
        },
      },
    },
    '/admin/analytics/reports/profit-loss': {
      get: {
        summary: 'Get profit and loss by session using bet collection and ledger payout truth',
        tags: ['Admin Analytics'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'sessionDate', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'marketId', schema: { type: 'string' } },
          { in: 'query', name: 'fromDate', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'toDate', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20, maximum: 100 } },
          { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['sessionDate', 'totalCollection', 'totalPayout', 'netProfit'] } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          200: {
            description: 'Profit/loss report retrieved',
          },
        },
      },
    },
    '/admin/reports/winning-history': {
      get: {
        summary: 'Get result-based winning history derived from currentResult',
        tags: ['Admin Analytics'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'sessionDate', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'marketId', schema: { type: 'string' } },
          { in: 'query', name: 'gameType', schema: { type: 'string' } },
          { in: 'query', name: 'phase', schema: { type: 'string', enum: ['open', 'close'] } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20, maximum: 100 } },
          { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['createdAt', 'betAmount', 'recordedPayout', 'username'] } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          200: {
            description: 'Winning history retrieved',
          },
        },
      },
    },
  },
};
