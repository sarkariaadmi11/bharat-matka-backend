/**
 * OpenAPI specification fragment for Revert Batch endpoints.
 *
 * Schemas follow the "no guessing required" principle: every field is typed,
 * described, and enumerated.  Frontend developers should be able to build the
 * entire admin UI from this document alone.
 */
module.exports = {
  tags: [
    {
      name: 'Admin Revert Batches',
      description:
        'Resumable, idempotent revert batch management. '
        + 'Allows admins to refund bet stakes in bulk without one giant database transaction. '
        + 'Batches are chunked, crash-safe, and can be resumed from the last processed cursor.',
    },
    {
      name: 'Admin Revert All',
      description:
        'One-click "clear & refund all" for a session. '
        + 'Creates a revert batch covering both open and close bets (no phase filter) '
        + 'and enqueues it for async background processing. '
        + 'Does not wait for refund completion — poll the batch status endpoint.',
    },
  ],

  components: {
    schemas: {

      // ── Request schemas ──────────────────────────────────────────────────────
      CreateRevertBatchRequest: {
        type: 'object',
        required: ['reason', 'idempotencyKey'],
        properties: {
          reason: {
            type: 'string',
            minLength: 3,
            maxLength: 500,
            description:
              'Mandatory human-readable reason. Recorded permanently on the batch document '
              + 'and on every affected bet record for audit traceability.',
            example: 'Session cancelled due to technical issue',
          },
          note: {
            type: 'string',
            maxLength: 1000,
            nullable: true,
            description: 'Optional additional context for the admin log.',
            example: 'Confirmed by operations lead',
          },
          idempotencyKey: {
            type: 'string',
            minLength: 8,
            maxLength: 128,
            description:
              'Caller-supplied idempotency key. Same key + same payload → replay previous result. '
              + 'Same key + different payload → 409 Conflict. '
              + 'Prevents duplicate batches when admin UIs retry on network errors.',
            example: 'revert-session-abc123-open-2026-04-24',
          },
        },
      },

      // ── Response schemas ─────────────────────────────────────────────────────
      RevertBatchProgress: {
        type: 'object',
        description: 'Live progress counters for the batch execution.',
        properties: {
          matchedCount: {
            type: 'integer',
            description: 'Total bets matched by the filter criteria at preflight time.',
          },
          eligibleCount: {
            type: 'integer',
            description: 'Bets that passed revert-eligibility checks.',
          },
          processedCount: {
            type: 'integer',
            description: 'Bets attempted so far (includes skipped and failed).',
          },
          refundedCount: {
            type: 'integer',
            description: 'Bets successfully refunded.',
          },
          refundedAmount: {
            type: 'integer',
            description: 'Total stake amount (in paisa) refunded across all refunded bets.',
          },
          skippedCount: {
            type: 'integer',
            description: 'Bets skipped because they were already reverted (idempotent guard).',
          },
          failedCount: {
            type: 'integer',
            description: 'Bets that failed their individual refund step.',
          },
          lastProcessedCursor: {
            type: 'string',
            nullable: true,
            description:
              'Opaque resume cursor (last processed bet _id). '
              + 'Used to resume execution after a crash without re-processing already-done bets.',
          },
        },
      },

      RevertBatchData: {
        type: 'object',
        description:
          'Revert batch state. A batch in "failed" status can be resumed by '
          + 'POSTing to the same endpoint with the same idempotencyKey. '
          + 'Already-processed bets are never re-refunded.',
        properties: {
          batchId: { type: 'string', description: 'Batch document ID.' },
          sessionId: { type: 'string', nullable: true },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'failed'],
            description:
              '"failed" does not mean unrecoverable — the batch can be resumed. '
              + '"completed" means all eligible bets were processed.',
          },
          reason: { type: 'string' },
          note: { type: 'string', nullable: true },
          idempotencyKey: { type: 'string' },
          resultRevisionObserved: {
            type: 'integer',
            nullable: true,
            description: 'Result revision on the session at the time of preflight evaluation.',
          },
          progress: { $ref: '#/components/schemas/RevertBatchProgress' },
          failureReason: {
            type: 'string',
            nullable: true,
            description: 'Human-readable failure description. Present only when status = "failed".',
          },
          startedAt: { type: 'string', format: 'date-time', nullable: true },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          failedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },

  paths: {
    '/admin/results/sessions/{sessionId}/revert-batches': {
      post: {
        summary: 'Create and queue a revert batch for async processing',
        description:
          'Creates a new revert batch (or replays an existing one via idempotencyKey), '
          + 'runs preflight eligibility validation, then enqueues the batch for async '
          + 'background processing. '
          + 'Returns immediately with the batch reference — poll the GET status endpoint '
          + 'to track progress. '
          + '**Revert only refunds stake. It does not reverse settlement payouts.**',
        tags: ['Admin', 'Admin Revert Batches'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'sessionId',
            required: true,
            schema: { type: 'string' },
            description: 'Game session ID.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateRevertBatchRequest' },
              example: {
                reason: 'Session cancelled due to technical issue',
                idempotencyKey: 'revert-session-abc123-2026-04-24',
              },
            },
          },
        },
        responses: {
          200: {
            description:
              'Batch created and queued for async processing. '
              + 'Poll GET /admin/results/revert-batches/:batchId for status. '
              + '"completed" means all bets were processed; '
              + '"failed" means partial progress — re-POST with same idempotencyKey to resume.',
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
                            batch: { $ref: '#/components/schemas/RevertBatchData' },
                            replayed: {
                              type: 'boolean',
                              description: 'true if an existing batch was returned/resumed.',
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
          400: {
            description:
              'Validation failed (missing fields, no eligible bets).',
          },
          404: { description: 'Session not found.' },
          409: {
            description:
              'idempotencyKey reused with different payload, or a concurrent batch is already active.',
          },
        },
      },

      get: {
        summary: 'List revert batches for a session',
        description: 'Returns all revert batches for a session, newest first.',
        tags: ['Admin', 'Admin Revert Batches'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'sessionId', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Paginated list of revert batches.',
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
                            items: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/RevertBatchData' },
                            },
                            pagination: { $ref: '#/components/schemas/Pagination' },
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

    '/admin/results/revert-batches/{batchId}': {
      get: {
        summary: 'Get revert batch status',
        description:
          'Fetch a single revert batch by ID. Use this for polling after creating a long-running batch.',
        tags: ['Admin', 'Admin Revert Batches'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'path',
            name: 'batchId',
            required: true,
            schema: { type: 'string' },
            description: 'Revert batch document ID.',
          },
        ],
        responses: {
          200: {
            description: 'Batch document with current status and progress counters.',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/RevertBatchData' },
                      },
                    },
                  ],
                },
              },
            },
          },
          404: { description: 'Batch not found.' },
        },
      },
    },
  },
};
