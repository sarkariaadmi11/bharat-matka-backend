const config = require('@config');
const express = require('express');
const cors = require('cors');
const { errorHandler, requestLogger } = require('@middleware');
const { sendSuccess } = require('@utils');
const { ipLimiter } = require('@middleware/rateLimiter');
const { apiDocsBasicAuth } = require('@middleware/apiDocsBasicAuth');
const routes = require('./routes');
const openapiSpec = require('../../docs/openapi');
const { createOpenApiUiMiddleware } = require('../../docs/openapiUi');
const dns = require('node:dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

const openapiUi = createOpenApiUiMiddleware({
  ui: config.OPENAPI_UI || process.env.OPENAPI_UI || 'scalar',
  specUrl: '/openapi.json',
});
const app = express();
app.set('trust proxy', 1);

const allowedOrigins = (config.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(requestLogger);
app.use(ipLimiter);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  sendSuccess(
    res,
    { status: 'Server is running', environment: config.NODE_ENV },
    'Health check',
  );
});

app.get('/', (req, res) => {
  sendSuccess(res, { version: config.API_VERSION }, 'Welcome to Betting API');
});

app.use(`/api/${config.API_VERSION}`, routes);

app.get('/openapi.json', apiDocsBasicAuth, (req, res) => {
  res.json(openapiSpec);
});

app.get('/openapi/v1.json', apiDocsBasicAuth, (req, res) => {
  res.json(openapiSpec);
});

app.use('/api-docs', apiDocsBasicAuth, openapiUi);

app.use((req, res) => {
  sendSuccess(res, null, 'Route not found', 404);
});

app.use(errorHandler);

module.exports = app;

