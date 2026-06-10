module.exports = {
  tags: [
    {
      name: 'Admin Settings',
      description: 'Admin-only system settings and configuration',
    },
  ],
  paths: {
    '/admin/settings': {
      get: {
        summary: 'Get app settings',
        description: 'Retrieve all app settings including deposit/withdrawal/betting limits and time windows',
        tags: ['Admin Settings'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Settings retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/AppSettings',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - invalid or missing admin token',
          },
          403: {
            description: 'Forbidden - admin access required',
          },
        },
      },
      put: {
        summary: 'Update app settings',
        description: 'Partially update app settings. Only provided fields will be updated.',
        tags: ['Admin Settings'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AppSettingsUpdateRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Settings updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/AppSettings',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: 'Validation error - invalid field values',
          },
          401: {
            description: 'Unauthorized - invalid or missing admin token',
          },
          403: {
            description: 'Forbidden - admin access required',
          },
        },
      },
    },
    '/admin/settings/support-contact': {
      get: {
        summary: 'Get support contact settings',
        description: 'Retrieve global support contact details (WhatsApp number, Telegram link, support email)',
        tags: ['Admin Settings'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Support contact settings retrieved',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/SupportContactSettings',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - invalid or missing admin token',
          },
          403: {
            description: 'Forbidden - admin access required',
          },
        },
      },
      patch: {
        summary: 'Update support contact settings',
        description: 'Update global support contact details (WhatsApp number, Telegram link, support email)',
        tags: ['Admin Settings'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SupportContactUpdateRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Support contact settings updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          allOf: [
                            { $ref: '#/components/schemas/SupportContactSettings' },
                            {
                              type: 'object',
                              properties: {
                                updatedAt: {
                                  type: 'string',
                                  format: 'date-time',
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: {
            description: 'Validation error (invalid phone/email format or missing fields)',
          },
          401: {
            description: 'Unauthorized - invalid or missing admin token',
          },
          403: {
            description: 'Forbidden - admin access required',
          },
        },
      },
    },
  },
  components: {
    schemas: {
      AppSettings: {
        type: 'object',
        properties: {
          minimumDeposit: { type: 'number', example: 100 },
          maximumDeposit: { type: 'number', example: 100000 },
          minimumWithdrawal: { type: 'number', example: 100 },
          maximumWithdrawal: { type: 'number', example: 100000 },
          minimumBidAmount: { type: 'number', example: 10 },
          maximumBidAmount: { type: 'number', example: 10000 },
          welcomeBonus: { type: 'number', example: 5 },
          withdrawOpenTime: { type: 'string', example: '09:00' },
          withdrawCloseTime: { type: 'string', example: '13:00' },
          globalBetting: { type: 'boolean', example: false },
          resultDeclarationGraceHours: { type: 'number', example: 5 },
        },
      },
      AppSettingsUpdateRequest: {
        type: 'object',
        properties: {
          minimumDeposit: { type: 'number', minimum: 0, description: 'Minimum deposit amount in INR' },
          maximumDeposit: { type: 'number', minimum: 0, description: 'Maximum deposit amount in INR' },
          minimumWithdrawal: { type: 'number', minimum: 0, description: 'Minimum withdrawal amount in INR' },
          maximumWithdrawal: { type: 'number', minimum: 0, description: 'Maximum withdrawal amount in INR' },
          minimumBidAmount: { type: 'number', minimum: 0, description: 'Minimum bid/bet amount in INR' },
          maximumBidAmount: { type: 'number', minimum: 0, description: 'Maximum bid/bet amount in INR' },
          welcomeBonus: { type: 'number', minimum: 0, description: 'Welcome bonus amount in INR' },
          withdrawOpenTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '09:00', description: 'Withdrawal window open time in HH:mm' },
          withdrawCloseTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '13:00', description: 'Withdrawal window close time in HH:mm' },
          globalBetting: { type: 'boolean', description: 'Master switch to enable/disable all betting' },
          resultDeclarationGraceHours: { type: 'integer', minimum: 0, maximum: 23, description: 'Grace hours for result declaration' },
        },
      },
    },
  },
};
