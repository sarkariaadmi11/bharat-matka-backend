module.exports = {
  'tags': [
    {
      'name': 'Admin Results',
      'description': 'Admin result declaration',
    },
    {
      'name': 'Admin Simulation',
      'description': 'Admin result profitability simulation',
    },
  ],
  'paths': {
    '/admin/results/sessions/{sessionId}/open': {
      'post': {
        'summary': 'Declare open result',
        'description': 'Declare open pana, auto-derive open digit, create a tracked settlement job, and return immediate settlement visibility.',
        'tags': [
          'Admin',
          'Admin Results',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'path',
            'name': 'sessionId',
            'required': true,
            'schema': {
              'type': 'string',
            },
          },
        ],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': {
                '$ref': '#/components/schemas/DeclareOpenResultRequest',
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Open result declared',
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
                          '$ref': '#/components/schemas/AdminResultDeclarationData',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': {
            'description': 'Invalid request/session phase',
          },
          '404': {
            'description': 'Session not found',
          },
        },
      },
    },
    '/admin/results/sessions/{sessionId}/close': {
      'post': {
        'summary': 'Declare close result',
        'description': 'Declare close pana, auto-derive close digit, create a tracked settlement job, and return immediate settlement visibility.',
        'tags': [
          'Admin',
          'Admin Results',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'path',
            'name': 'sessionId',
            'required': true,
            'schema': {
              'type': 'string',
            },
          },
        ],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': {
                '$ref': '#/components/schemas/DeclareCloseResultRequest',
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Close result declared',
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
                          '$ref': '#/components/schemas/AdminResultDeclarationData',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': {
            'description': 'Invalid request/session phase',
          },
          '404': {
            'description': 'Session not found',
          },
        },
      },
    },
    '/admin/results/sessions/{sessionId}/reset-open': {
      'post': {
        'summary': 'Reset open result',
        'description': 'Clear the currently displayed open result, create a new result revision, and leave wallet balances untouched so the admin can declare a corrected result later.',
        'tags': ['Admin', 'Admin Results'],
        'security': [{ 'bearerAuth': [] }],
        'parameters': [{ 'in': 'path', 'name': 'sessionId', 'required': true, 'schema': { 'type': 'string' } }],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': { '$ref': '#/components/schemas/ResetOpenResultRequest' },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Open result reset',
            'content': {
              'application/json': {
                'schema': {
                  'allOf': [
                    { '$ref': '#/components/schemas/ApiSuccess' },
                    { 'type': 'object', 'properties': { 'data': { '$ref': '#/components/schemas/AdminResultDeclarationData' } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/admin/results/sessions/{sessionId}/reset-close': {
      'post': {
        'summary': 'Reset close result',
        'description': 'Clear the currently displayed close result, create a new result revision, and leave wallet balances untouched so the admin can declare a corrected result later.',
        'tags': ['Admin', 'Admin Results'],
        'security': [{ 'bearerAuth': [] }],
        'parameters': [{ 'in': 'path', 'name': 'sessionId', 'required': true, 'schema': { 'type': 'string' } }],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': { '$ref': '#/components/schemas/ResetCloseResultRequest' },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Close result reset',
            'content': {
              'application/json': {
                'schema': {
                  'allOf': [
                    { '$ref': '#/components/schemas/ApiSuccess' },
                    { 'type': 'object', 'properties': { 'data': { '$ref': '#/components/schemas/AdminResultDeclarationData' } } },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/admin/results/sessions/{sessionId}/simulate': {
      'post': {
        'summary': 'Simulate top profitable outcomes',
        'description': 'Simulate outcomes and return top 10 profitable combinations sorted by profit desc.',
        'tags': [
          'Admin',
          'Admin Simulation',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'path',
            'name': 'sessionId',
            'required': true,
            'schema': {
              'type': 'string',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'Simulation completed',
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
                          '$ref': '#/components/schemas/AdminSimulationData',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': {
            'description': 'Invalid request/session phase',
          },
          '404': {
            'description': 'Session not found',
          },
        },
      },
    },
    '/admin/results/sessions/{sessionId}/preview-winners/{phase}/{pana}': {
      'get': {
        'summary': 'Preview winners for a specific result',
        'description': 'See who will win and how much if admin declares this specific result (pana + phase). Returns paginated list of winners with payouts, market, game type, and session info.',
        'tags': [
          'Admin',
          'Admin Results',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'path',
            'name': 'sessionId',
            'required': true,
            'schema': {
              'type': 'string',
              'description': 'Game session ID',
            },
          },
          {
            'in': 'path',
            'name': 'phase',
            'required': true,
            'schema': {
              'type': 'string',
              'enum': ['OPEN_RUNNING', 'CLOSE_RUNNING'],
              'description': 'Session phase for which to preview winners',
            },
          },
          {
            'in': 'path',
            'name': 'pana',
            'required': true,
            'schema': {
              'type': 'string',
              'pattern': '^\\d{3}$',
              'description': '3-digit pana result (e.g., 456)',
            },
          },
          {
            'in': 'query',
            'name': 'page',
            'schema': {
              'type': 'integer',
              'default': 1,
              'description': 'Page number for pagination',
            },
          },
          {
            'in': 'query',
            'name': 'limit',
            'schema': {
              'type': 'integer',
              'default': 50,
              'description': 'Number of records per page',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'Winners preview generated successfully',
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
                          'type': 'array',
                          'items': {
                            'type': 'object',
                            'properties': {
                              'id': {
                                'type': 'string',
                                'description': 'Row id (for motor: {betId}_{pana})',
                              },
                              'betId': {
                                'type': 'string',
                                'description': 'Stored bet document id',
                              },
                              'userId': {
                                'type': 'string',
                                'description': 'User ID of the bettor',
                              },
                              'username': {
                                'type': 'string',
                                'description': 'Username of the bettor',
                              },
                              'selection': {
                                'type': 'string',
                                'description': 'Bet selection (pana/digit/jodi) or single motor line pana',
                              },
                              'betDigit': {
                                'type': 'string',
                                'description': 'Bet digit for UI display',
                              },
                              'gameType': {
                                'type': 'string',
                                'description': 'Game type code (PANA, JODI, MOTOR, etc.)',
                              },
                              'market': {
                                'type': 'string',
                                'description': 'Market code or name (KALYAN, RAJDHANI, etc.)',
                              },
                              'session': {
                                'type': 'string',
                                'enum': ['Open', 'Close'],
                                'description': 'Session type',
                              },
                              'isExpanded': {
                                'type': 'boolean',
                                'description': 'True if this is an expanded motor row',
                              },
                              'expansionKey': {
                                'type': 'string',
                                'description': 'The specific pana for this expanded motor row',
                                'nullable': true,
                              },
                              'motorLineHit': {
                                'type': 'boolean',
                                'nullable': true,
                                'description': 'For motor rows: true if this line matches the preview pana; null for non-motor',
                              },
                              'totalAmount': {
                                'type': 'number',
                                'description': 'Total stake in INR for the full stored bet',
                              },
                              'betAmount': {
                                'type': 'number',
                                'description': 'Stake in INR for this row (line stake for expanded motor)',
                              },
                              'totalPayout': {
                                'type': 'number',
                                'description': 'Payout in INR attributed to this winning row',
                              },
                              'payout': {
                                'type': 'number',
                                'description': 'Same as totalPayout for preview rows',
                              },
                              'createdAt': {
                                'type': 'string',
                                'format': 'date-time',
                                'description': 'Bet creation timestamp',
                              },
                            },
                          },
                        },
                        'summary': {
                          'type': 'object',
                          'properties': {
                            'totalWinningBets': {
                              'type': 'integer',
                              'description': 'Number of stored bets that would win',
                            },
                            'totalPreviewRows': {
                              'type': 'integer',
                              'description': 'Number of visible winning rows after motor line filtering (same as pagination total)',
                            },
                            'totalWinners': {
                              'type': 'integer',
                              'description': 'Alias of totalPreviewRows for backward compatibility',
                            },
                            'totalBets': {
                              'type': 'integer',
                              'description': 'Total bets placed for this session/phase',
                            },
                            'totalLosingBets': {
                              'type': 'integer',
                              'description': 'Total number of losing bets',
                            },
                            'totalWinningPayout': {
                              'type': 'number',
                              'description': 'Sum of winning payouts per stored bet in INR',
                            },
                          },
                        },
                        'pagination': {
                          'type': 'object',
                          'properties': {
                            'page': {
                              'type': 'integer',
                              'description': 'Current page number',
                            },
                            'limit': {
                              'type': 'integer',
                              'description': 'Records per page',
                            },
                            'total': {
                              'type': 'integer',
                              'description': 'Total number of winners',
                            },
                            'pages': {
                              'type': 'integer',
                              'description': 'Total number of pages',
                            },
                          },
                        },
                        'previewInfo': {
                          'type': 'object',
                          'properties': {
                            'sessionId': {
                              'type': 'string',
                              'description': 'Game session ID',
                            },
                            'phase': {
                              'type': 'string',
                              'enum': ['OPEN_RUNNING', 'CLOSE_RUNNING'],
                              'description': 'Session phase',
                            },
                            'resultPana': {
                              'type': 'string',
                              'description': 'The pana result being previewed',
                            },
                            'resultDigit': {
                              'type': 'string',
                              'description': 'Auto-derived digit from pana sum',
                            },
                            'market': {
                              'type': 'string',
                              'description': 'Market code or name',
                            },
                            'marketId': {
                              'type': 'string',
                              'description': 'Market ID',
                            },
                            'previewedAt': {
                              'type': 'string',
                              'format': 'date-time',
                              'description': 'Timestamp when preview was generated',
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': {
            'description': 'Invalid phase or pana format',
          },
          '404': {
            'description': 'Session or market not found',
          },
        },
      },
    },
  },
};
