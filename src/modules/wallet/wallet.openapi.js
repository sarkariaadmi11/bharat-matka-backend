module.exports = {
  'tags': [
    {
      'name': 'Wallet',
      'description': 'Wallet & Transactions',
    },
  ],
  'paths': {
    '/wallet': {
      'get': {
        'summary': 'Get wallet',
        'tags': [
          'Wallet',
        ],
        'description': 'Returns wallet amounts in rupee.',
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'responses': {
          '200': {
            'description': 'Wallet summary (read-only)',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/WalletSummary',
                },
              },
            },
          },
        },
      },
    },
    '/wallet/transactions': {
      'get': {
        'summary': 'Get wallet transaction history',
        'tags': [
          'Wallet',
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
            'description': 'Paginated transaction list',
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
    '/wallet/admin/credit': {
      'post': {
        'summary': 'Credit Wallet (Admin)',
        'tags': [
          'Wallet',
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
                  'userId',
                  'amount',
                ],
                'properties': {
                  'userId': {
                    'type': 'string',
                  },
                  'amount': {
                    '$ref': '#/components/schemas/MoneyINR',
                  },
                },
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Wallet credited successfully',
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
    '/wallet/upi-account': {
      'get': {
        'summary': 'Get current UPI payout account',
        'tags': [
          'Wallet',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'responses': {
          '200': {
            'description': 'UPI account retrieved',
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
                          '$ref': '#/components/schemas/WalletUpiAccount',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      'post': {
        'summary': 'Create or update current UPI payout account',
        'tags': [
          'Wallet',
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
                '$ref': '#/components/schemas/WalletUpiAccountRequest',
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'UPI account saved',
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
                          '$ref': '#/components/schemas/WalletUpiAccount',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/wallet/bank-accounts': {
      'post': {
        'summary': 'Add a bank account',
        'tags': [
          'Wallet',
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
                '$ref': '#/components/schemas/WalletBankAccountCreateRequest',
              },
              'example': {
                'accountHolderName': 'John Doe',
                'bankName': 'HDFC Bank',
                'accountNumber': '50100123456789',
                'ifscCode': 'HDFC0000123',
                'isPrimary': true,
              },
            },
          },
        },
        'responses': {
          '201': {
            'description': 'Bank account added',
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
                          '$ref': '#/components/schemas/WalletBankAccount',
                        },
                      },
                    },
                  ],
                },
                'example': {
                  'success': true,
                  'statusCode': 201,
                  'message': 'Bank account added',
                  'data': {
                    '_id': '65ff1aa616b1f1d2dde0fa11',
                    'userId': '65ff1aa616b1f1d2dde0fa10',
                    'accountHolderName': 'John Doe',
                    'bankName': 'HDFC Bank',
                    'accountNumber': '************6789',
                    'ifscCode': 'HDFC0000123',
                    'upiId': null,
                    'isDefault': true,
                    'isPrimary': true,
                    'createdAt': '2026-03-10T12:00:00.000Z',
                    'updatedAt': '2026-03-10T12:00:00.000Z',
                  },
                },
              },
            },
          },
        },
      },
      'get': {
        'summary': 'List bank accounts',
        'tags': [
          'Wallet',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'responses': {
          '200': {
            'description': 'Bank accounts retrieved',
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
                            '$ref': '#/components/schemas/WalletBankAccount',
                          },
                        },
                      },
                    },
                  ],
                },
                'example': {
                  'success': true,
                  'statusCode': 200,
                  'message': 'Bank accounts retrieved',
                  'data': [
                    {
                      '_id': '65ff1aa616b1f1d2dde0fa11',
                      'userId': '65ff1aa616b1f1d2dde0fa10',
                      'accountHolderName': 'John Doe',
                      'bankName': 'HDFC Bank',
                      'accountNumber': '************6789',
                      'ifscCode': 'HDFC0000123',
                      'upiId': null,
                      'isDefault': true,
                      'isPrimary': true,
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/wallet/bank-accounts/{id}': {
      'delete': {
        'summary': 'Delete a bank account',
        'tags': [
          'Wallet',
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
            'description': 'Bank account removed',
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
                          '$ref': '#/components/schemas/WalletBankAccount',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
};
