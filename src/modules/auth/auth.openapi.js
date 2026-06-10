module.exports = {
  'tags': [
    {
      'name': 'Auth',
      'description': 'Authentication & User Login',
    },
  ],
  'paths': {
    '/auth/register': {
      'post': {
        'summary': 'Register a new user',
        'tags': [
          'Auth',
        ],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': {
                '$ref': '#/components/schemas/AuthRegisterRequest',
              },
            },
          },
        },
        'responses': {
          '201': {
            'description': 'User registered successfully',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
          '400': {
            'description': 'Validation error',
          },
        },
      },
    },
    '/auth/login': {
      'post': {
        'summary': 'Log in a user',
        'tags': [
          'Auth',
        ],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': {
                '$ref': '#/components/schemas/AuthLoginRequest',
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Login successful',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
          '401': {
            'description': 'Invalid credentials',
          },
        },
      },
    },
    '/auth/refresh-token': {
      'post': {
        'summary': 'Refresh JWT access token',
        'tags': [
          'Auth',
        ],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': {
                '$ref': '#/components/schemas/AuthRefreshTokenRequest',
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Token refreshed successfully',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
          '401': {
            'description': 'Invalid refresh token',
          },
        },
      },
    },
    '/auth/forgot-password': {
      'post': {
        'summary': 'Request password reset',
        'tags': [
          'Auth',
        ],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': {
                '$ref': '#/components/schemas/AuthForgotPasswordRequest',
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Password reset initiated',
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
    '/auth/reset-password': {
      'post': {
        'summary': 'Reset user password',
        'tags': [
          'Auth',
        ],
        'requestBody': {
          'required': true,
          'content': {
            'application/json': {
              'schema': {
                '$ref': '#/components/schemas/AuthResetPasswordRequest',
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Password reset successfully',
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
    '/auth/change-password': {
      'post': {
        'summary': 'Change authenticated user password',
        'tags': [
          'Auth',
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
                '$ref': '#/components/schemas/AuthChangePasswordRequest',
              },
            },
          },
        },
        'responses': {
          '200': {
            'description': 'Password changed successfully',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
          '401': {
            'description': 'Current password is incorrect',
          },
        },
      },
    },
    '/auth/logout': {
      'post': {
        'summary': 'Logout authenticated user',
        'tags': [
          'Auth',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'responses': {
          '200': {
            'description': 'Logged out successfully',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
          '401': {
            'description': 'Unauthorized',
          },
        },
      },
    },
    '/auth/delete-account': {
      'delete': {
        'summary': "Delete authenticated user's account",
        'tags': [
          'Auth',
        ],
        'security': [
          {
            'bearerAuth': [],
          },
        ],
        'responses': {
          '200': {
            'description': 'Account deleted successfully',
            'content': {
              'application/json': {
                'schema': {
                  '$ref': '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
          '401': {
            'description': 'Unauthorized',
          },
        },
      },
    },
  },
};
