module.exports = {
  'tags': [
    {
      'name': 'Sessions',
      'description': 'Game sessions & lifecycle',
    },
  ],
  'paths': {
    '/sessions': {
      'get': {
        'summary': 'Get all sessions for today',
        'description': 'Retrieves all game sessions for today with market details.\nShows phase (open_running/close_running/market_closed/settled) and timing information.\n',
        'tags': [
          'GameSessions',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'responses': {
          '200': {
            'description': "List of today's sessions",
            'content': {
              'application/json': {
                'schema': {
                  'type': 'object',
                  'properties': {
                    'success': {
                      'type': 'boolean',
                    },
                    'data': {
                      'type': 'array',
                      'items': {
                        '$ref': '#/components/schemas/GameSession',
                      },
                    },
                    'message': {
                      'type': 'string',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/sessions/create-daily': {
      'get': {
        'summary': 'Create daily sessions for all active markets',
        'description': 'Creates a new gaming session for each active market for today.\nAutomatically schedules MARKET_LOCK tasks at close times.\nCall this endpoint once daily via cron or manually.\n',
        'tags': [
          'GameSessions',
        ],
        'responses': {
          '201': {
            'description': 'Daily sessions created successfully',
            'content': {
              'application/json': {
                'schema': {
                  'type': 'object',
                  'properties': {
                    'success': {
                      'type': 'boolean',
                    },
                    'data': {
                      'type': 'object',
                      'properties': {
                        'created': {
                          'type': 'integer',
                          'description': 'Number of sessions created',
                        },
                        'skipped': {
                          'type': 'integer',
                          'description': 'Number of duplicate sessions skipped',
                        },
                        'errors': {
                          'type': 'array',
                          'description': 'Any errors encountered',
                        },
                      },
                    },
                    'message': {
                      'type': 'string',
                    },
                  },
                },
              },
            },
          },
          '500': {
            'description': 'Server error',
          },
        },
      },
    },
    '/sessions/create-daily/status': {
      'get': {
        'summary': 'Get background daily-session creation job status',
        'description': 'Returns current status of the background daily-session creation process.\nUseful after triggering /sessions/create-daily, which runs asynchronously.\n',
        'tags': [
          'GameSessions',
        ],
        'responses': {
          '200': {
            'description': 'Job status retrieved successfully',
            'content': {
              'application/json': {
                'schema': {
                  'type': 'object',
                  'properties': {
                    'success': {
                      'type': 'boolean',
                    },
                    'data': {
                      'type': 'object',
                      'properties': {
                        'running': {
                          'type': 'boolean',
                        },
                        'startedAt': {
                          'type': 'string',
                          'format': 'date-time',
                          'nullable': true,
                        },
                        'finishedAt': {
                          'type': 'string',
                          'format': 'date-time',
                          'nullable': true,
                        },
                        'result': {
                          'type': 'object',
                          'nullable': true,
                          'properties': {
                            'created': {
                              'type': 'integer',
                            },
                            'skipped': {
                              'type': 'integer',
                            },
                            'errors': {
                              'type': 'array',
                              'items': {
                                'type': 'object',
                                'properties': {
                                  'marketId': {
                                    'type': 'string',
                                    'nullable': true,
                                  },
                                  'marketName': {
                                    'type': 'string',
                                    'nullable': true,
                                  },
                                  'error': {
                                    'type': 'string',
                                  },
                                },
                              },
                            },
                          },
                        },
                        'error': {
                          'type': 'string',
                          'nullable': true,
                        },
                      },
                    },
                    'message': {
                      'type': 'string',
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/sessions/status/summary': {
      'get': {
        'summary': 'Get market status summary for today',
        'description': 'Returns a summary of all markets showing:\n- Count by phase (open_running, close_running, market_closed, settled)\n- Individual market statuses\n- Current phase and timing\n',
        'tags': [
          'GameSessions',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'responses': {
          '200': {
            'description': 'Market status summary',
            'content': {
              'application/json': {
                'schema': {
                  'type': 'object',
                  'properties': {
                    'success': {
                      'type': 'boolean',
                    },
                    'data': {
                      'type': 'object',
                      'properties': {
                        'date': {
                          'type': 'string',
                          'format': 'date',
                        },
                        'summary': {
                          'type': 'object',
                          'properties': {
                            'total': {
                              'type': 'integer',
                            },
                            'openPhase': {
                              'type': 'integer',
                            },
                            'closePhase': {
                              'type': 'integer',
                            },
                            'settled': {
                              'type': 'integer',
                            },
                          },
                        },
                        'markets': {
                          'type': 'array',
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
    },
    '/sessions/date/{date}': {
      'get': {
        'summary': 'Get sessions for a specific date',
        'description': 'Retrieves game sessions for a given date.\nDate format must be YYYY-MM-DD.\n',
        'tags': [
          'GameSessions',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'path',
            'name': 'date',
            'required': true,
            'schema': {
              'type': 'string',
              'format': 'date',
              'example': '2026-01-19',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'Sessions for the specified date',
            'content': {
              'application/json': {
                'schema': {
                  'type': 'object',
                  'properties': {
                    'success': {
                      'type': 'boolean',
                    },
                    'data': {
                      'type': 'array',
                    },
                  },
                },
              },
            },
          },
          '400': {
            'description': 'Invalid date format',
          },
        },
      },
    },
    '/sessions/market/{marketId}': {
      'get': {
        'summary': 'Get active session for a market',
        'description': 'Retrieves the currently active (betting-eligible) session for a market.\nReturns null if no active session exists.\n',
        'tags': [
          'GameSessions',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'parameters': [
          {
            'in': 'path',
            'name': 'marketId',
            'required': true,
            'schema': {
              'type': 'string',
              'format': 'objectId',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'Active session for market',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/GameSession',
                },
              },
            },
          },
          '400': {
            'description': 'Invalid market ID',
          },
          '404': {
            'description': 'No active session for market',
          },
        },
      },
    },
    '/sessions/{sessionId}': {
      'get': {
        'summary': 'Get session details',
        'description': 'Retrieves detailed information about a specific session including\nphase, timing, and current results (if available).\n',
        'tags': [
          'GameSessions',
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
              'format': 'objectId',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'Session details',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/GameSession',
                },
              },
            },
          },
          '400': {
            'description': 'Invalid session ID',
          },
          '404': {
            'description': 'Session not found',
          },
        },
      },
    },
    '/admin/sessions': {
      'get': {
        'summary': 'Admin sessions overview (full detail)',
        'description': 'Returns ALL sessions for today with full admin-level snapshot including audit trails, result history, cancellation info, and declaration deadlines. Accepts optional ?date=YYYY-MM-DD query param. Admin-only.',
        'tags': [
          'Admin Sessions',
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
            'required': false,
            'schema': {
              'type': 'string',
              'format': 'date',
              'example': '2026-05-16',
            },
            'description': 'Optional date filter (YYYY-MM-DD). Defaults to today.',
          },
        ],
        'responses': {
          '200': {
            'description': 'Admin sessions overview retrieved',
            'content': {
              'application/json': {
                'schema': {
                  'type': 'object',
                  'properties': {
                    'success': { 'type': 'boolean' },
                    'data': {
                      'type': 'array',
                      'items': {
                        '$ref': '#/components/schemas/GameSession',
                      },
                    },
                    'message': { 'type': 'string' },
                  },
                },
              },
            },
          },
          '401': {
            'description': 'Unauthorized - invalid or missing token',
          },
          '403': {
            'description': 'Forbidden - admin access required',
          },
        },
      },
    },
    '/sessions/{sessionId}/lock': {
      'post': {
        'summary': 'Lock session (transition to close phase)',
        'description': "Locks a session, transitioning it to 'market_closed' phase.\nNo more betting allowed (OPEN and CLOSE bets disabled).\nTypically called automatically when close time arrives (e.g., 8:00 PM).\n",
        'tags': [
          'GameSessions',
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
              'format': 'objectId',
            },
          },
        ],
        'responses': {
          '200': {
            'description': 'Session locked successfully',
            'content': {
              'application/json': {
                'schema': {
                  'type': 'object',
                  'properties': {
                    'success': {
                      'type': 'boolean',
                    },
                    'data': {
                      'type': 'object',
                      'properties': {
                        'sessionId': {
                          'type': 'string',
                        },
                        'marketName': {
                          'type': 'string',
                        },
                        'phase': {
                          'type': 'string',
                          'enum': [
                            'open_running',
                            'close_running',
                            'market_closed',
                            'settled',
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            'description': 'Invalid session ID or cannot lock',
          },
          '403': {
            'description': 'Admin/system access required',
          },
          '404': {
            'description': 'Session not found',
          },
        },
      },
    },
  },
};
