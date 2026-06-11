const config = require('@config/environment');
const schemas = require('@config/openapi/schema');

const moduleSpecs = [
  require('@modules/auth/auth.openapi'),
  require('@modules/users/users.openapi'),
  require('@modules/bets/bets.openapi'),
  require('@modules/motor/motor.openapi'),
  require('@modules/wallet/wallet.openapi'),
  require('@modules/payments/payments.openapi'),
  require('@modules/sessions/sessions.openapi'),
  require('@modules/results/results.openapi'),
  require('@modules/notifications/notifications.openapi'),
  require('@modules/markets/markets.openapi'),
  require('@modules/system/system.openapi'),
  require('@modules/admin/results/adminResults.openapi'),
  require('@modules/admin/results/revertBatch.openapi'),   // Resumable revert batch endpoints
  require('@modules/admin/results/bidHistory.openapi'),    // Admin bid history
  require('@modules/admin/users/adminUsers.openapi'),
  require('@modules/admin/markets/adminMarkets.openapi'),
  require('@modules/admin/gameTypes/adminGameTypes.openapi'),
  require('@modules/admin/analytics/adminAnalytics.openapi'),
  require('@modules/admin/reports/adminReports.openapi'),
  require('@modules/admin/notifications/adminNotifications.openapi'),
  require('@modules/admin/withdrawals/adminWithdrawals.openapi'),
  require('@modules/admin/logs/adminLogs.openapi'),
  require('@modules/admin/settings/adminSettings.openapi'),
];

const mergeUniqueTags = (target, tags = []) => {
  const seen = new Set(target.map((t) => t.name));
  tags.forEach((tag) => {
    if (!seen.has(tag.name)) {
      target.push(tag);
      seen.add(tag.name);
    }
  });
};

const mergeObjects = (target, source) => {
  Object.entries(source || {}).forEach(([key, value]) => {
    if (!target[key]) {
      target[key] = value;
      return;
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      target[key] = { ...target[key], ...value };
      return;
    }
    target[key] = value;
  });
};

const baseSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Mahadev Matka API',
    version: '1.0.0',
    description: `
# Mahadev Matka Backend API

This API powers the betting engine, session lifecycle,
result declaration system, wallet transactions,
and admin control panel.

## Result Settlement Flow
- Admin result declaration writes the session result state
- Result declaration schedules an async settlement task
- /system/heartbeat triggers background task processing
- Close-result settlement resolves deferred final-result bets such as Jodi
- A session is marked as settled only after async settlement completes

## Authentication
All protected routes require:

Authorization: Bearer <JWT_TOKEN>

## Base URL
https://yourdomain.com/api

## Error Format
All errors follow:

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message"
  }
}
`,
    contact: {
      name: 'bharat-matka team',
      email: 'sarkariaadmi11@gmail.com',
    },
  },
  servers: [
    {
      url: `${config.API_URI}/api/${config.API_VERSION}`,
      description: 'Default server',
    },
  ],
  tags: [],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ...schemas,
      MoneyINR: {
        type: 'number',
        format: 'float',
        description: 'Amount in INR exposed by the API. Internally stored as paise (integer).',
        example: 10,
      },
      ApiSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'integer', example: 200 },
          message: { type: 'string' },
          data: { nullable: true },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          details: { nullable: true },
          requestId: { type: 'string', nullable: true },
        },
      },
    },
    headers: {
      'X-Request-Id': {
        description: 'Request correlation id',
        schema: { type: 'string' },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {},
};

moduleSpecs.forEach((spec) => {
  mergeUniqueTags(baseSpec.tags, spec.tags || []);
  mergeObjects(baseSpec.paths, spec.paths || {});
  if (spec.components) {
    mergeObjects(baseSpec.components, spec.components);
  }
});

delete baseSpec.paths['/admin/results/sessions/{sessionId}/declare'];

module.exports = baseSpec;
