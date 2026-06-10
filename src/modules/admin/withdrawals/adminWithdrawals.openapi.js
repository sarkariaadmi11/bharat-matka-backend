module.exports = {
  tags: [
    {
      name: 'AdminPayments',
      description: 'Admin withdrawal approvals and payment transaction logs',
    },
  ],
  paths: {
    '/admin/payments/transactions': {
      get: {
        summary: 'List payment-related wallet transaction logs',
        tags: ['AdminPayments'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'userId',
            schema: { type: 'string' },
          },
          {
            in: 'query',
            name: 'page',
            schema: { type: 'integer', default: 1 },
          },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'Payment transaction logs',
          },
        },
      },
    },
    '/admin/payments/deposits/history': {
      get: {
        summary: 'List auto-deposit history for all users',
        tags: ['AdminPayments'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'fromDate',
            schema: { type: 'string', format: 'date' },
          },
          {
            in: 'query',
            name: 'toDate',
            schema: { type: 'string', format: 'date' },
          },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['pending', 'submitted', 'verifying', 'manual_review', 'processing', 'success', 'failed'] },
          },
          {
            in: 'query',
            name: 'provider',
            schema: { type: 'string', enum: ['razorpay', 'upi_intent'] },
          },
          {
            in: 'query',
            name: 'userId',
            schema: { type: 'string' },
          },
          {
            in: 'query',
            name: 'page',
            schema: { type: 'integer', default: 1 },
          },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'Admin auto-deposit history',
          },
        },
      },
    },
    '/admin/payments/withdrawals': {
      get: {
        summary: 'Admin withdrawal list',
        tags: ['AdminPayments'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'status',
            schema: {
              type: 'string',
              enum: ['pending', 'approved', 'rejected'],
            },
          },
          {
            in: 'query',
            name: 'page',
            schema: { type: 'integer', default: 1 },
          },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', default: 20 },
          },
        ],
        responses: {
          200: {
            description: 'Withdrawal list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', example: '65ff1aa616b1f1d2dde0fa82' },
                          userId: { type: 'string', example: '65ff1aa616b1f1d2dde0fa11' },
                          username: { type: 'string', example: 'rahul123' },
                          phone: { type: 'string', example: '9999999999' },
                          email: { type: 'string', example: 'rahul@example.com', nullable: true },
                          amount: { type: 'number', example: 2000 },
                          bankAccount: { type: 'string', example: 'XXXX1234' },
                          upiId: { type: 'string', example: 'rahul@upi', nullable: true },
                          method: { type: 'string', example: 'bank' },
                          status: { type: 'string', example: 'pending' },
                          reference: { type: 'string', example: 'ORDER_1712145678901_12ab34cd', nullable: true },
                          requestedAt: { type: 'string', format: 'date-time' },
                          processedAt: { type: 'string', format: 'date-time', nullable: true },
                          canApprove: { type: 'boolean', example: true },
                          canReject: { type: 'boolean', example: true },
                          adminRemarks: { type: 'string', example: 'Verified details', nullable: true },
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
    },
    '/admin/payments/withdrawals/{payoutId}/approve': {
      post: {
        summary: 'Approve withdrawal request',
        tags: ['AdminPayments'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'payoutId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdminApprovalActionRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Withdrawal approved',
          },
        },
      },
    },
    '/admin/payments/withdrawals/{payoutId}/reject': {
      post: {
        summary: 'Reject withdrawal request',
        tags: ['AdminPayments'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'payoutId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdminApprovalActionRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Withdrawal rejected',
          },
        },
      },
    },
  },
};
