module.exports = {
  tags: [
    {
      name: 'Admin Game Types',
      description: 'Admin game type configuration APIs',
    },
  ],
  paths: {
    '/admin/game-types': {
      get: {
        summary: 'List game types',
        tags: ['Admin Game Types'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Game types retrieved successfully',
          },
        },
      },
      post: {
        summary: 'Create game type',
        tags: ['Admin Game Types'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'name', 'templateKey', 'payoutMultiplier'],
                properties: {
                  code: { type: 'string', example: 'SINGLE_ALIAS' },
                  name: { type: 'string', example: 'Single Alias' },
                  templateKey: { type: 'string', example: 'SINGLE_DIGIT' },
                  payoutMultiplier: { type: 'number', example: 9.5 },
                  minBet: { type: 'integer', example: 10 },
                  maxBet: { type: 'integer', example: 10000 },
                  status: { type: 'string', enum: ['active', 'inactive'] },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Game type created successfully',
          },
        },
      },
    },
    '/admin/game-types/{id}': {
      get: {
        summary: 'Get game type',
        tags: ['Admin Game Types'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Game type retrieved successfully',
          },
        },
      },
      patch: {
        summary: 'Update game type',
        tags: ['Admin Game Types'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
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
                  code: { type: 'string', example: 'SINGLE' },
                  name: { type: 'string', example: 'Single Digit' },
                  templateKey: { type: 'string', example: 'SINGLE_DIGIT' },
                  payoutMultiplier: { type: 'number', example: 9.5 },
                  minBet: { type: 'integer', example: 10 },
                  maxBet: { type: 'integer', example: 10000 },
                  status: { type: 'string', enum: ['active', 'inactive'] },
                  enabled: { type: 'boolean', example: true },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Game type updated successfully',
          },
        },
      },
      delete: {
        summary: 'Soft delete game type',
        tags: ['Admin Game Types'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Game type deleted successfully',
          },
        },
      },
    },
  },
};
