module.exports = {
  tags: [
    {
      name: 'Admin Reports',
      description: 'Admin analytics and reporting APIs',
    },
  ],
  paths: {
    '/admin/reports/bids': {
      get: {
        summary: 'Get bid report',
        tags: ['Admin Reports'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'marketId', schema: { type: 'string' } },
          { in: 'query', name: 'sessionDate', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'gameType', schema: { type: 'string' } },
          { in: 'query', name: 'userId', schema: { type: 'string' } },
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['pending', 'won', 'lost', 'cancelled', 'refunded'] } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 } },
          { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['createdAt', 'amount', 'status', 'selection', 'username'] } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          200: {
            description: 'Bid report retrieved',
          },
        },
      },
    },
    '/admin/reports/winning-history': {
      get: {
        summary: 'Get winning history',
        tags: ['Admin Reports'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'marketId', schema: { type: 'string' } },
          { in: 'query', name: 'sessionDate', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'gameType', schema: { type: 'string' } },
          { in: 'query', name: 'phase', schema: { type: 'string', enum: ['open', 'close'] } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20, maximum: 100 } },
          { in: 'query', name: 'sortBy', schema: { type: 'string', enum: ['createdAt', 'payout', 'amount', 'username'] } },
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
