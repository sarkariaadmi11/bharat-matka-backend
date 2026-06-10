const {
  DEPOSIT_PROVIDER,
  DEPOSIT_STATUS,
  WITHDRAWAL_METHOD,
  WITHDRAWAL_STATUS,
} = require('@config/constants/payments');

module.exports = {
  tags: [
    {
      name: 'Account',
      description: 'User self-scoped account APIs',
    },
  ],
  paths: {
    '/my/profile': {
      get: {
        summary: 'Get profile',
        tags: ['Account'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'User profile retrieved',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserPublic',
                },
              },
            },
          },
        },
      },
    },
    '/my/wallet': {
      get: {
        summary: 'Get wallet summary',
        tags: ['Account'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Wallet summary (amounts in rupee; same contract as /wallet)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WalletSummary',
                },
              },
            },
          },
        },
      },
    },
    '/my/transactions': {
      get: {
        summary: 'Get transaction history',
        tags: ['Account'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'page',
            schema: {
              type: 'integer',
              default: 1,
            },
          },
          {
            in: 'query',
            name: 'limit',
            schema: {
              type: 'integer',
              default: 20,
            },
          },
        ],
        responses: {
          200: {
            description: 'Paginated transaction ledger with session, market, game type, selection, and derived settlement context when available.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
        },
      },
    },
    '/my/deposits': {
      get: {
        summary: 'Get deposit request history',
        tags: ['Account'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1, minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
          { in: 'query', name: 'status', schema: { type: 'string', enum: Object.values(DEPOSIT_STATUS) } },
          { in: 'query', name: 'provider', schema: { type: 'string', enum: [DEPOSIT_PROVIDER.RAZORPAY, DEPOSIT_PROVIDER.UPI_INTENT] } },
          { in: 'query', name: 'fromDate', schema: { type: 'string', format: 'date-time' } },
          { in: 'query', name: 'toDate', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          200: {
            description: 'Reverse chronological deposit request history with stable sort and a `{ data, meta }` response.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserDepositHistoryResponse',
                },
              },
            },
          },
        },
      },
    },
    '/my/withdrawals': {
      get: {
        summary: 'Get withdrawal request history',
        tags: ['Account'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1, minimum: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
          { in: 'query', name: 'status', schema: { type: 'string', enum: Object.values(WITHDRAWAL_STATUS) } },
          { in: 'query', name: 'method', schema: { type: 'string', enum: Object.values(WITHDRAWAL_METHOD) } },
          { in: 'query', name: 'fromDate', schema: { type: 'string', format: 'date-time' } },
          { in: 'query', name: 'toDate', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          200: {
            description: 'Reverse chronological withdrawal request history with masked beneficiary fields and a `{ data, meta }` response.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserWithdrawalHistoryResponse',
                },
              },
            },
          },
        },
      },
    },
    '/my/bets': {
      get: {
        summary: 'Get bet history',
        tags: ['Account'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'page',
            schema: {
              type: 'integer',
              default: 1,
            },
          },
          {
            in: 'query',
            name: 'limit',
            schema: {
              type: 'integer',
              default: 20,
            },
          },
        ],
        responses: {
          200: {
            description: 'Paginated bet history',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
        },
      },
    },
  },
};
