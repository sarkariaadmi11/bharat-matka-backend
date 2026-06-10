module.exports = {
  'tags': [
    {
      'name': 'Bets',
      'description': 'Bet placement and history',
    },
  ],
  'paths': {
    '/bets/my-bets': {
      'get': {
        'summary': 'Get bet history',
        'description': 'Returns the existing flat bet history format. Motor bets are expanded into one row per selected pana while non-motor bets remain one row per stored bet.',
        'tags': [
          'Bets',
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
        ],
        'responses': {
          '200': {
            'description': 'Paginated list of bets',
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
    '/bets/place': {
      'post': {
        'summary': 'Place one or more bets',
        'tags': [
          'Bets',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': {
                'type': 'object',
                'required': [
                  'sessionId',
                  'gameTypeId',
                  'bets',
                ],
                'properties': {
                  'sessionId': {
                    'type': 'string',
                    'description': 'GameSession ID',
                  },
                  'gameTypeId': {
                    'type': 'string',
                    'description': 'GameType ID (Single, Jodi, Pana, etc.)',
                  },
                  'bets': {
                    'type': 'array',
                    'minItems': 1,
                    'items': {
                      'type': 'object',
                      'required': [
                        'value',
                        'amount',
                        'betMode',
                      ],
                      'properties': {
                        'value': {
                          'description': 'Structure depends on GameType.rules.parts.\nPana values are canonicalized internally with digit 0 treated as highest (for example, 012 becomes 120), except motor `panas` arrays which must already be submitted in canonical form.\nExamples provided below.\nHalf Sangam A: { "openPana": "128", "closeDigit": "6" }\nHalf Sangam B: { "openDigit": "5", "closePana": "128" }\nSP Motor: generate panas from /motor/generate, let the user prune them, then place { "panas": ["123", "124", "234"] }.\nFor SP_MOTOR and DP_MOTOR, `amount` is the total stake for the whole selected `panas` set, not the stake per pana. Example: 3 panas with amount 15 means 5 per pana.\n',
                          'oneOf': [
                            {
                              '$ref': '#/components/schemas/SingleDigitValue',
                            },
                            {
                              '$ref': '#/components/schemas/JodiValue',
                            },
                            {
                              '$ref': '#/components/schemas/SinglePanaValue',
                            },
                            {
                              '$ref': '#/components/schemas/DoublePanaValue',
                            },
                            {
                              '$ref': '#/components/schemas/HalfSangamValue',
                            },
                            {
                              '$ref': '#/components/schemas/HalfSangamAValue',
                            },
                            {
                              '$ref': '#/components/schemas/HalfSangamBValue',
                            },
                            {
                              '$ref': '#/components/schemas/SpMotorValue',
                            },
                            {
                              '$ref': '#/components/schemas/DpMotorValue',
                            },
                          ],
                        },
                        'amount': {
                          'allOf': [
                            {
                              '$ref': '#/components/schemas/MoneyINR',
                            },
                          ],
                          'description': 'Stake amount in INR. For normal bets, this is the stake for that selection. For SP_MOTOR and DP_MOTOR, this is the total stake across all selected panas in the same bet item.',
                        },
                        'betMode': {
                          'type': 'string',
                          'enum': [
                            'open',
                            'close',
                          ],
                          'description': 'Bet mode for this selection',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        'responses': {
          '201': {
            'description': 'Bets placed successfully',
          },
        },
      },
    },
  },
};
