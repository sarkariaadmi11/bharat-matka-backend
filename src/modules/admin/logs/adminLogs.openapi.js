module.exports = {
  'tags': [
    {
      'name': 'Logs',
      'description': 'Admin logs and observability',
    },
  ],
  'paths': {
    '/admin/logs': {
      'get': {
        'summary': 'Get application logs (paginated)',
        'tags': [
          'Logs',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'responses': {
          '200': {
            'description': 'Logs retrieved',
            'headers': {
              'X-Request-Id': {
                '$ref': '#/components/headers/X-Request-Id',
              },
            },
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/LogListResponse',
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
          '403': {
            'description': 'Forbidden',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiError',
                },
              },
            },
          },
        },
        'parameters': [
          {
            'in': 'query',
            'name': 'level',
            'schema': {
              'type': 'string',
            },
          },
          {
            'in': 'query',
            'name': 'requestId',
            'schema': {
              'type': 'string',
            },
          },
          {
            'in': 'query',
            'name': 'userId',
            'schema': {
              'type': 'string',
            },
          },
          {
            'in': 'query',
            'name': 'route',
            'schema': {
              'type': 'string',
            },
          },
          {
            'in': 'query',
            'name': 'method',
            'schema': {
              'type': 'string',
            },
          },
          {
            'in': 'query',
            'name': 'statusCode',
            'schema': {
              'type': 'integer',
            },
          },
          {
            'in': 'query',
            'name': 'from',
            'schema': {
              'type': 'string',
              'format': 'date-time',
            },
          },
          {
            'in': 'query',
            'name': 'to',
            'schema': {
              'type': 'string',
              'format': 'date-time',
            },
          },
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
              'default': 50,
            },
          },
        ],
      },
    },
  },
};
