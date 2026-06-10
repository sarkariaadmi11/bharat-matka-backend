module.exports = {
  'tags': [
    {
      'name': 'Markets',
      'description': 'Market and session APIs',
    },
  ],
  'paths': {
    '/markets': {
      'get': {
        'summary': 'Get list of active markets with current session status',
        'tags': [
          'Markets',
        ],
        'description': 'Returns active markets ordered by today\'s close time so markets appear in closing sequence.',
        'responses': {
          '200': {
            'description': 'Array of markets with result display and available game types',
            'content': {
              'application/json': {
                'schema': {
                  'type': 'array',
                  'items': {
                    '$ref': '#/components/schemas/Market',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/markets/results/today': {
      'get': {
        'summary': "Get today's market results and session status",
        'tags': [
          'Markets',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'responses': {
          '200': {
            'description': 'Market results for today',
            'content': {
              'application/json': {
                'schema': {
                  'type': 'object',
                  'properties': {
                    'date': {
                      'type': 'string',
                    },
                    'results': {
                      'type': 'array',
                      'items': {
                        '$ref': '#/components/schemas/MarketResult',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/markets/{code}/status': {
      'get': {
        'summary': "Get today's session status for a market",
        'tags': [
          'Markets',
        ],
        'description': 'Looks up an active market by market code and returns today\'s session status.',
        'parameters': [
          {
            'in': 'path',
            'name': 'code',
            'required': true,
            'schema': {
              'type': 'string',
            },
            'description': 'Market code (e.g., KALYAN)',
          },
        ],
        'responses': {
          '200': {
            'description': 'Market session status',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
          '404': {
            'description': 'Market not found or inactive',
          },
        },
      },
    },
    '/game-types': {
      'get': {
        'tags': [
          'Markets',
        ],
        'summary': 'Game rates',
        'responses': {
          '200': {
            'description': 'Game rates',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
        },
      },
    },
    '/game-types/rates': {
      'get': {
        'summary': 'Get game rates / odds (GlobalConfig + GameTypes)',
        'tags': [
          'Game Rates',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'responses': {
          '200': {
            'description': 'Rates retrieved',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/GameRates',
                },
              },
            },
          },
        },
      },
    },
  },
};
