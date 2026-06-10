module.exports = {
  'tags': [
    {
      'name': 'System',
      'description': 'Internal system endpoints',
    },
  ],
  'paths': {
    '/system/heartbeat': {
      'get': {
        'summary': 'Trigger background task processing',
        'description': 'Internal endpoint used to trigger background task execution\n(settlement, market locks, session creation).\nDoes not block the request lifecycle.\n',
        'tags': [
          'System',
        ],
        'responses': {
          '200': {
            'description': 'Task runner triggered successfully',
            'content': {
              'application/json': {
                'schema': {
                  'type': 'object',
                  'properties': {
                    'success': {
                      'type': 'boolean',
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
  },
};
