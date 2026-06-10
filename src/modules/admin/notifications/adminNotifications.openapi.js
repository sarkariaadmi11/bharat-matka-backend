module.exports = {
  tags: [
    {
      name: 'Admin Notifications',
      description: 'Admin notification delivery',
    },
  ],
  paths: {
    '/admin/notifications': {
      post: {
        summary: 'Send notification to users',
        tags: ['Admin', 'Admin Notifications'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  body: { type: 'string' },
                  userIds: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  sendToAll: { type: 'boolean' },
                  data: { type: 'object' },
                },
                required: ['title', 'body'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Notification sent',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiSuccess',
                },
              },
            },
          },
        },
      },
    },
  },
};
