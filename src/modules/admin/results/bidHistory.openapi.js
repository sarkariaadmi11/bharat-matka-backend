module.exports = {
  tags: [
    {
      name: 'Admin Bid History',
      description: 'Paginated admin read-only bid history for sessions.',
    },
  ],

  components: {
    schemas: {
      BidHistoryItem: {
        type: 'object',
        properties: {
          betId: { type: 'string', description: 'Bet document ID.' },
          date: { type: 'string', format: 'date-time', description: 'Bet creation timestamp.' },
          username: { type: 'string', description: 'Username of the bettor.' },
          gameType: { type: 'string', description: 'Game type code (e.g. PANA, JODI).' },
          points: { type: 'integer', description: 'Stake amount in paisa.' },
          betMode: { type: 'string', enum: ['open', 'close'], description: 'Bet mode / phase.' },
          selection: { type: 'string', description: 'Bet selection.' },
          status: { type: 'string', description: 'Bet status.' },
        },
      },
    },
  },

  paths: {
    '/admin/results/bid-history': {
      get: {
        summary: 'Paginated bid history for a session',
        description:
          'Returns a paginated list of bets for admin review. '
          + 'Accepts sessionId directly, or date + marketId to resolve the session. '
          + 'Each row includes betId, date, username, gameType, points, betMode, selection, and status. '
          + 'Read-only — no mutations occur.',
        tags: ['Admin', 'Admin Bid History'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'sessionId',
            required: false,
            schema: { type: 'string' },
            description: 'Session ID (alternative to date+marketId).',
          },
          {
            in: 'query',
            name: 'date',
            required: false,
            schema: { type: 'string', format: 'date' },
            description: 'Session date in YYYY-MM-DD format (used with marketId).',
          },
          {
            in: 'query',
            name: 'marketId',
            required: false,
            schema: { type: 'string' },
            description: 'Market ID (used with date).',
          },
          {
            in: 'query',
            name: 'page',
            schema: { type: 'integer', default: 1 },
            description: 'Page number.',
          },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', default: 20, maximum: 100 },
            description: 'Items per page.',
          },
        ],
        responses: {
          200: {
            description: 'Paginated bid history.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            items: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/BidHistoryItem' },
                            },
                            pagination: { $ref: '#/components/schemas/Pagination' },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { description: 'Missing required query parameters.' },
          404: { description: 'Session not found.' },
        },
      },
    },
  },
};
