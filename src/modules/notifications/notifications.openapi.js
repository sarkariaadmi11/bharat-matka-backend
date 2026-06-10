module.exports = {
  'tags': [
    {
      'name': 'Notifications',
      'description': 'Device token registration',
    },
  ],
  'paths': {
    '/notifications/register-device': {
      'post': {
        'summary': 'Register or refresh a device FCM token',
        'tags': [
          'Notifications',
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
                '$ref': '#/components/schemas/NotificationRegisterDeviceRequest',
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Device registered successfully',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
          '400': {
            'description': 'Invalid input',
          },
        },
      },
    },
    '/notifications/update-device': {
      'put': {
        'summary': 'Rotate an existing device token',
        'tags': [
          'Notifications',
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
                '$ref': '#/components/schemas/NotificationUpdateTokenRequest',
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Device token updated successfully',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
          '400': {
            'description': 'Invalid input',
          },
        },
      },
    },
    '/notifications/remove-device': {
      'delete': {
        'summary': 'Deactivate a device token',
        'tags': [
          'Notifications',
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
                '$ref': '#/components/schemas/NotificationRemoveTokenRequest',
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Device removed successfully',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
          '400': {
            'description': 'Invalid input',
          },
        },
      },
    },
  },
};
