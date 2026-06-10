const swaggerJSDoc = require('swagger-jsdoc');
const config = require('../environment');
const schemas = require('./schema');

// const swaggerDefinition = {
//   openapi: '3.0.0',
//   info: {
//     title: 'Mahadev Matka API Documentation',
//     version: config.API_VERSION,
//     description:
//       'This is the API documentation for the Mahadev Matka application. It provides endpoints for user management and authentication.',
//     contact: {
//       name: 'Shubham Singh',
//       email: 'Shubham.singh325601@gmail.com',
//     },
//   },
//   servers: [
//     {
//       url: `${config.API_URI}/api/${config.API_VERSION}`,
//       description: 'Development server',
//     },
//   ],
//   components: {
//     securitySchemes: {
//       bearerAuth: {
//         type: 'http',
//         scheme: 'bearer',
//         bearerFormat: 'JWT',
//       },
//     },
//     schemas,
//   },
//   security: [
//     {
//       bearerAuth: [],
//     },
//   ],
// };

// const options = {
//   swaggerDefinition,
//   apis: [
//     './routes/*.js',
//   ],
// };

// const swaggerSpec = swaggerJSDoc(options);

// module.exports = swaggerSpec;
const swaggerDefinition = {
  openapi: '3.0.3',

  info: {
    title: 'Mahadev Matka API',
    version: '1.0.0',
    description: `
# Mahadev Matka Backend API

This API powers the betting engine, session lifecycle,
result declaration system, wallet transactions,
and admin control panel.

## Authentication
All protected routes require:

Authorization: Bearer <JWT_TOKEN>

## Base URL
https://yourdomain.com/api

## Environments
- Production
- Staging
- Localhost

## Error Format
All errors follow:

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message"
  }
}

Refer to individual endpoints for request/response examples.
    `,
    contact: {
      name: 'Shubham Singh',
      email: 'shubham.singh325601@gmail.com',
    },
  },

  servers: [
    {
      url: `${config.API_URI}/api/${config.API_VERSION}`,
      description: 'Development server',
    },
  ],

  tags: [
    { name: 'Auth', description: 'Authentication & User Login' },
    { name: 'Wallet', description: 'Wallet & Transactions' },
    { name: 'Betting', description: 'Place & Manage Bets' },
    { name: 'Sessions', description: 'Game Sessions & Lifecycle' },
    { name: 'Results', description: 'Game Result Declaration & Retrieval' },
    { name: 'Admin', description: 'Admin Control & Configuration' },
    { name: 'System', description: 'Health, Logs, Background Jobs' },
    { name: 'Account', description: 'User self-scoped account APIs' },
    { name: 'Payments', description: 'Razorpay UPI deposits, bank details, and withdrawal requests' },
    { name: 'AdminPayments', description: 'Admin payment approvals and logs' },
    { name: 'Markets', description: 'Market and session APIs' },
    { name: 'Game Rates', description: 'Game Rates & Payout' },
    { name: 'Bets', description: 'Bet placement and history' },
    { name: 'AdminResults', description: 'Admin result simulation and declaration' },
    { name: 'Games', description: 'User-safe game result APIs' },
    { name: 'Notifications', description: 'Device token registration and notification preferences' },
    { name: 'Logs', description: 'Admin logs and observability' },
    { name: 'Admin Users', description: 'Admin user management' },
    { name: 'Admin Results', description: 'Admin result declaration' },
    { name: 'Admin Simulation', description: 'Admin result profitability simulation' },
    { name: 'Admin Markets', description: 'Admin market management' },
    { name: 'Admin Game Types', description: 'Admin game type management' },
    { name: 'Admin Reports', description: 'Admin reporting and analytics' },
  ],

  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },

    schemas: Object.assign({}, schemas, {
      MoneyINR: {
        type: 'number',
        format: 'float',
        description:
          'Amount in INR exposed by the API. Internally stored as paise (integer).',
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
    }),
    headers: {
      'X-Request-Id': {
        description: 'Request correlation id',
        schema: {
          type: 'string',
        },
      },
    },
  },

  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./routes/*.js', './src/modules/**/*.js'],
};

module.exports = swaggerJSDoc(options);
