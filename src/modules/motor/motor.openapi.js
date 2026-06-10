module.exports = {
  tags: [
    {
      name: 'Motor',
      description: 'Motor combination generation',
    },
  ],
  paths: {
    '/motor/generate': {
      post: {
        summary: 'Generate motor pana combinations (SP or DP)',
        tags: ['Motor'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MotorGenerateRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Motor combinations generated',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/MotorGenerateResponse' },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { description: 'Validation failed or feature disabled' },
          401: { description: 'Unauthorized' },
        },
      },
    },
  },
};
