module.exports = {
  'tags': [
    {
      'name': 'Results',
      'description': 'User-safe game results',
    },
  ],
  'paths': {
    '/games/results': {
      'get': {
        'summary': 'Get game results by date',
        'description': 'Returns user-safe market results for a given IST session date.\nUse optional marketId to filter a specific market.\n',
        'tags': [
          'Games',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'query',
            'name': 'date',
            'required': true,
            'schema': {
              'type': 'string',
              'format': 'date',
              'example': '2026-03-01',
            },
          },
          {
            'in': 'query',
            'name': 'marketId',
            'required': false,
            'schema': {
              'type': 'string',
              'example': '65ff1aa616b1f1d2dde0fa82',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'Game results retrieved',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/GameResultsListResponse',
                },
              },
            },
          },
          '400': {
            'description': 'Invalid query parameters',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiError',
                },
              },
            },
          },
          '401': {
            'description': 'Unauthorized',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiError',
                },
              },
            },
          },
        },
      },
    },
  },
};
