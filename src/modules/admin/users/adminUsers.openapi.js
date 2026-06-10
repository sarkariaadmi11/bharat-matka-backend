module.exports = {
  'tags': [
    {
      'name': 'Admin Users',
      'description': 'Admin user management',
    },
  ],
  'paths': {
    '/admin/users': {
      'get': {
        'summary': 'List users',
        'description': 'List users with pagination, search and status filters for admin panel.',
        'tags': [
          'Admin',
          'Admin Users',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'query',
            'name': 'page',
            'schema': {
              'type': 'integer',
              'default': 1,
            },
          },
          {
            'in': 'query',
            'name': 'limit',
            'schema': {
              'type': 'integer',
              'default': 20,
            },
          },
          {
            'in': 'query',
            'name': 'search',
            'schema': {
              'type': 'string',
            },
          },
          {
            'in': 'query',
            'name': 'status',
            'schema': {
              'type': 'string',
              'enum': [
                'active',
                'blocked',
              ],
            },
          },
          {
            'in': 'query',
            'name': 'sortBy',
            'schema': {
              'type': 'string',
              'enum': [
                'createdAt',
                'updatedAt',
                'lastLoginAt',
                'username',
              ],
              'default': 'createdAt',
            },
          },
          {
            'in': 'query',
            'name': 'order',
            'schema': {
              'type': 'string',
              'enum': [
                'asc',
                'desc',
              ],
              'default': 'desc',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'Users list fetched',
            'content': {
              'application/json': {
                'schema': {
                  'allOf': [
                    {
                      '$ref': '#/components/schemas/ApiSuccess',
                    },
                    {
                      'type': 'object',
                      'properties': {
                        'data': {
                          '$ref': '#/components/schemas/AdminUsersListData',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': {
            'description': 'Validation error',
          },
          '401': {
            'description': 'Unauthorized',
          },
          '403': {
            'description': 'Admin access required',
          },
        },
      },
    },
    '/admin/users/{id}': {
      'get': {
        'summary': 'Get user details',
        'description': 'Fetch profile, wallet/exposure, status and account metadata for one user.',
        'tags': [
          'Admin',
          'Admin Users',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'path',
            'name': 'id',
            'required': true,
            'schema': {
              'type': 'string',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'User details fetched',
            'content': {
              'application/json': {
                'schema': {
                  'allOf': [
                    {
                      '$ref': '#/components/schemas/ApiSuccess',
                    },
                    {
                      'type': 'object',
                      'properties': {
                        'data': {
                          '$ref': '#/components/schemas/AdminUserDetailsData',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': {
            'description': 'User not found',
          },
        },
      },
    },
    '/admin/users/{id}/block': {
      'patch': {
        'summary': 'Block user',
        'description': 'Set user status to blocked and revoke active refresh token hash.',
        'tags': [
          'Admin',
          'Admin Users',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'path',
            'name': 'id',
            'required': true,
            'schema': {
              'type': 'string',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'User blocked successfully',
            'content': {
              'application/json': {
                'schema': {
                  'allOf': [
                    {
                      '$ref': '#/components/schemas/ApiSuccess',
                    },
                    {
                      'type': 'object',
                      'properties': {
                        'data': {
                          '$ref': '#/components/schemas/AdminUserStatusActionData',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': {
            'description': 'User not found',
          },
        },
      },
    },
    '/admin/users/{id}/unblock': {
      'patch': {
        'summary': 'Unblock user',
        'description': 'Restore user status to active.',
        'tags': [
          'Admin',
          'Admin Users',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'path',
            'name': 'id',
            'required': true,
            'schema': {
              'type': 'string',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'User unblocked successfully',
            'content': {
              'application/json': {
                'schema': {
                  'allOf': [
                    {
                      '$ref': '#/components/schemas/ApiSuccess',
                    },
                    {
                      'type': 'object',
                      'properties': {
                        'data': {
                          '$ref': '#/components/schemas/AdminUserStatusActionData',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': {
            'description': 'User not found',
          },
        },
      },
    },
    '/admin/users/{id}/stats': {
      'get': {
        'summary': 'Get user betting stats',
        'description': 'Aggregated betting stats for admin analytics.',
        'tags': [
          'Admin',
          'Admin Users',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'path',
            'name': 'id',
            'required': true,
            'schema': {
              'type': 'string',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'Stats fetched',
            'content': {
              'application/json': {
                'schema': {
                  'allOf': [
                    {
                      '$ref': '#/components/schemas/ApiSuccess',
                    },
                    {
                      'type': 'object',
                      'properties': {
                        'data': {
                          '$ref': '#/components/schemas/AdminUserStatsData',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': {
            'description': 'User not found',
          },
        },
      },
    },
    '/admin/users/{id}/bets': {
      'get': {
        'summary': 'Get user bets',
        'description': 'Fetch a paginated list of user bets. Motor bets are automatically expanded so each pana selection appears as a separate row.',
        'tags': ['Admin', 'Admin Users'],
        'security': [{ 'bearerAuth': [] }],
        'parameters': [
          { 'in': 'path', 'name': 'id', 'required': true, 'schema': { 'type': 'string' } },
          { 'in': 'query', 'name': 'page', 'schema': { 'type': 'integer', 'default': 1 } },
          { 'in': 'query', 'name': 'limit', 'schema': { 'type': 'integer', 'default': 20 } },
          { 'in': 'query', 'name': 'status', 'schema': { 'type': 'string', 'enum': ['pending', 'won', 'lost', 'cancelled'] } },
          { 'in': 'query', 'name': 'market', 'schema': { 'type': 'string' } },
          { 'in': 'query', 'name': 'gameType', 'schema': { 'type': 'string' } },
          { 'in': 'query', 'name': 'date', 'schema': { 'type': 'string', 'format': 'date' } },
        ],
        'responses': {
          '200': {
            'description': 'User bets retrieved',
            'content': {
              'application/json': {
                'schema': {
                  'allOf': [
                    { '$ref': '#/components/schemas/ApiSuccess' },
                    {
                      'type': 'object',
                      'properties': {
                        'data': { '$ref': '#/components/schemas/AdminUserBetsData' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': { 'description': 'User not found' },
        },
      },
    },
    '/admin/users/{id}/transactions': {
      'get': {
        'summary': 'Get user transactions',
        'tags': ['Admin', 'Admin Users'],
        'security': [{ 'bearerAuth': [] }],
        'responses': {
          '200': { 'description': 'User transactions retrieved' },
        },
      },
    },
    '/admin/users/{id}/wallet-adjustments': {
      'post': {
        'summary': 'Create wallet adjustment',
        'description': 'Canonical admin wallet adjustment endpoint with idempotent replay semantics.',
        'tags': ['Admin', 'Admin Users'],
        'security': [{ 'bearerAuth': [] }],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': { '$ref': '#/components/schemas/AdminWalletAdjustmentRequest' },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Wallet adjustment recorded',
            'content': {
              'application/json': {
                'schema': {
                  'allOf': [
                    { '$ref': '#/components/schemas/ApiSuccess' },
                    { 'type': 'object', 'properties': { 'data': { '$ref': '#/components/schemas/AdminWalletAdjustmentData' } } },
                  ],
                },
              },
            },
          },
          '409': { 'description': 'Idempotency key conflict' },
        },
      },
    },
    '/admin/users/{id}/reset-password': {
      'patch': {
        'summary': 'Reset user password',
        'tags': ['Admin', 'Admin Users'],
        'security': [{ 'bearerAuth': [] }],
        'responses': {
          '200': { 'description': 'Password reset' },
        },
      },
    },
    '/admin/users/{id}/bets/{betId}': {
      'patch': {
        'summary': 'Edit user bet',
        'description': 'Admin can modify pending bets. For expanded motor rows, the betId must be formatted as {storedBetId}_{pana}.',
        'tags': ['Admin', 'Admin Users'],
        'security': [{ 'bearerAuth': [] }],
        'parameters': [
          { 'in': 'path', 'name': 'id', 'required': true, 'schema': { 'type': 'string' } },
          { 'in': 'path', 'name': 'betId', 'required': true, 'schema': { 'type': 'string', 'description': 'Can be standard mongoId or {mongoId}_{pana} for motor rows' } },
        ],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': { '$ref': '#/components/schemas/AdminBetEditRequest' },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'User bet updated',
            'content': {
              'application/json': {
                'schema': {
                  'allOf': [
                    { '$ref': '#/components/schemas/ApiSuccess' },
                    {
                      'type': 'object',
                      'properties': {
                        'data': { '$ref': '#/components/schemas/AdminBetEditData' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': { 'description': 'User or bet not found' },
          '422': { 'description': 'Bet is not pending or invalid modification' },
        },
      },
      'delete': {
        'summary': 'Delete user bet',
        'description': 'Admin can cancel pending bets. For expanded motor rows, cancelling a row refunds only that row\'s stake.',
        'tags': ['Admin', 'Admin Users'],
        'security': [{ 'bearerAuth': [] }],
        'parameters': [
          { 'in': 'path', 'name': 'id', 'required': true, 'schema': { 'type': 'string' } },
          { 'in': 'path', 'name': 'betId', 'required': true, 'schema': { 'type': 'string', 'description': 'Can be standard mongoId or {mongoId}_{pana} for motor rows' } },
        ],
        'responses': {
          '200': {
            'description': 'User bet deleted',
            'content': {
              'application/json': {
                'schema': {
                  'allOf': [
                    { '$ref': '#/components/schemas/ApiSuccess' },
                    {
                      'type': 'object',
                      'properties': {
                        'data': { '$ref': '#/components/schemas/AdminBetDeleteData' },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': { 'description': 'User or bet not found' },
          '422': { 'description': 'Bet is not pending' },
        },
      },
    },
  },
};
