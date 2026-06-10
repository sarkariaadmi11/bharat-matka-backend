module.exports = {
  tags: [
    {
      name: 'Payments',
      description: 'Deposits, UPI intent payments, and withdrawal requests',
    },
  ],
  paths: {
    '/payments/deposits/initiate': {
      post: {
        summary: 'Create Razorpay order for UPI checkout',
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DepositOrderCreateRequest',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Razorpay order created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/DepositOrderCreateResponse',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/payments/deposits/verify': {
      post: {
        summary: 'Verify Razorpay checkout payment and credit wallet',
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PaymentVerifyRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Payment verified and wallet credited',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/DepositSettlementResult',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/payments/deposits/initiate-upi': {
      post: {
        summary: 'Create a pending direct UPI intent deposit',
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/DepositOrderCreateRequest',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'UPI intent deposit created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/UpiDepositInitiateResponse',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/payments/deposits/history': {
      get: {
        summary: 'Fetch successful deposit history for authenticated user',
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        parameters: [
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
            description: 'Deposit history',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            documents: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/DepositHistoryItem' },
                            },
                            pagination: {
                              type: 'object',
                              properties: {
                                page: { type: 'integer', example: 1 },
                                limit: { type: 'integer', example: 20 },
                                total: { type: 'integer', example: 1 },
                                pages: { type: 'integer', example: 1 },
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/payments/deposits/upi-callback': {
      post: {
        summary: 'Submit client-side UPI app result for deposit verification',
        tags: ['Payments'],
        description: 'Call this when the app resumes after deep linking into a UPI app. The response is the primary source of truth for frontend state. If data.status is success, use data.walletBalance immediately. walletBalance is returned in rupee. If status is submitted or verifying, poll the status endpoint.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpiDepositCallbackRequest',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'UPI deposit callback accepted',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/UpiDepositStatus',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/payments/deposits/{depositId}/status': {
      get: {
        summary: 'Fetch current UPI deposit status',
        tags: ['Payments'],
        description: 'Poll this endpoint after app resume when the callback response is still pending or verifying. walletBalance is returned in rupee on success. Stop polling on success, failed, or manual_review.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'depositId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Current deposit status',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/UpiDepositStatus',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/payments/webhook/razorpay': {
      post: {
        summary: 'Razorpay payment webhook for deposit settlement',
        tags: ['Payments'],
        parameters: [
          {
            in: 'header',
            name: 'x-razorpay-signature',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RazorpayWebhookPayload',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Webhook processed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiSuccess' },
              },
            },
          },
        },
      },
    },
    '/payments/withdrawals/request': {
      post: {
        summary: 'Create manual withdrawal request (uses wallet bank account, admin approval required)',
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/WithdrawalRequestCreate',
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Withdrawal request submitted in pending state',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Payout',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
};
