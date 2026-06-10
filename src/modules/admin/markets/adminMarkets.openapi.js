module.exports = {
  tags: [
    {
      name: 'Admin Markets',
      description: 'Admin market configuration APIs',
    },
  ],
  paths: {
    '/admin/markets': {
      get: {
        summary: 'List admin markets with today\'s session and result data',
        tags: ['Admin Markets'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['active', 'inactive'] },
            description: 'Filter by market status. Defaults to active.',
          },
        ],
        responses: {
          200: {
            description: 'Admin markets retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    statusCode: { type: 'integer', example: 200 },
                    message: { type: 'string', example: 'Admin markets retrieved successfully' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/AdminMarketItem' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create market configuration',
        tags: ['Admin Markets'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name', 'openTime', 'closeTime', 'schedule', 'gameTypes'],
                properties: {
                  code: { type: 'string', example: 'KALYAN_DAY' },
                  name: { type: 'string', example: 'Kalyan Day' },
                  status: { type: 'string', enum: ['active', 'inactive'] },
                  description: { type: 'string', example: 'Day market' },
                  openTime: { type: 'string', example: '10:00' },
                  closeTime: { type: 'string', example: '11:00' },
                  schedule: {
                    type: 'object',
                    example: {
                      mon: true,
                      tue: true,
                      wed: true,
                      thu: true,
                      fri: true,
                      sat: false,
                      sun: false,
                    },
                  },
                  gameTypes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['gameTypeId'],
                      properties: {
                        gameTypeId: { type: 'string', example: 'SINGLE' },
                        payoutMultiplier: { type: 'number', example: 9.5 },
                        minBet: { type: 'number', example: 10 },
                        maxBet: { type: 'number', example: 10000 },
                        status: { type: 'string', enum: ['active', 'inactive'] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Market created successfully',
          },
        },
      },
    },
    '/admin/markets/{marketId}': {
      patch: {
        summary: 'Edit market configuration',
        tags: ['Admin Markets'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'marketId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Kalyan Day Updated' },
                  code: { type: 'string', example: 'KALYAN_DAY' },
                  openTime: { type: 'string', example: '10:30' },
                  closeTime: { type: 'string', example: '11:00' },
                  schedule: {
                    type: 'object',
                    example: {
                      sat: true,
                    },
                  },
                  status: { type: 'string', enum: ['active', 'inactive'] },
                  gameTypes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['gameTypeId'],
                      properties: {
                        gameTypeId: { type: 'string', example: 'SINGLE' },
                        payoutMultiplier: { type: 'number', example: 9.5 },
                        minBet: { type: 'number', example: 20 },
                        maxBet: { type: 'number', example: 10000 },
                        status: { type: 'string', enum: ['active', 'inactive'] },
                      },
                    },
                  },
                  description: { type: 'string', example: 'Updated market window' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Market updated successfully',
          },
        },
      },
      delete: {
        summary: 'Soft delete market configuration',
        tags: ['Admin Markets'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'marketId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Market deleted successfully',
          },
        },
      },
    },
    '/admin/markets/{marketId}/gametypes': {
      get: {
        summary: 'Get game types configured for a specific market',
        tags: ['Admin Markets'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'marketId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Market game types retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    statusCode: { type: 'integer', example: 200 },
                    message: { type: 'string', example: 'Market game types retrieved successfully' },
                    data: { $ref: '#/components/schemas/AdminMarketGameTypes' },
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
