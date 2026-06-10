const express = require('express');
const http = require('http');

describe('payment routes auth', () => {
  let server;

  const startServer = async (app) =>
    await new Promise((resolve) => {
      const instance = http.createServer(app);
      instance.listen(0, () => resolve(instance));
    });

  const stopServer = async (instance) =>
    await new Promise((resolve, reject) => {
      instance.close((error) => (error ? reject(error) : resolve()));
    });

  const sendJsonRequest = async ({ port, path, method, body }) =>
    await new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const request = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (response) => {
          let responseBody = '';
          response.on('data', (chunk) => {
            responseBody += chunk;
          });
          response.on('end', () => {
            resolve({
              statusCode: response.statusCode,
              body: JSON.parse(responseBody),
            });
          });
        },
      );

      request.on('error', reject);
      request.write(payload);
      request.end();
    });

  beforeEach(() => {
    jest.resetModules();

    jest.doMock('@middleware/auth', () => ({
      requireAuth: (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            statusCode: 401,
            message: 'Authorization token missing',
            timestamp: new Date().toISOString(),
          });
        }

        req.user = { id: 'user-1' };
        return next();
      },
    }));

    jest.doMock('@middleware/rateLimiter', () => ({
      userLimiter: (_req, _res, next) => next(),
    }));

    jest.doMock('@modules/payments/payment.controller', () => ({
      initiateDeposit: (_req, res) => res.status(200).json({ ok: true }),
      initiateUpiDeposit: (_req, res) => res.status(201).json({ ok: true }),
      getDepositHistory: (_req, res) => res.status(200).json({ ok: true }),
      verifyDepositPayment: (_req, res) => res.status(200).json({ ok: true }),
      handleUpiDepositCallback: (_req, res) => res.status(200).json({ ok: true }),
      getUpiDepositStatus: (_req, res) => res.status(200).json({ ok: true }),
      handleRazorpayWebhook: (_req, res) => res.status(200).json({ ok: true }),
      requestWithdrawal: (_req, res) => res.status(201).json({ ok: true }),
    }));
  });

  afterEach(async () => {
    if (server) {
      await stopServer(server);
      server = null;
    }
  });

  test('rejects unauthorized initiate-upi request', async () => {
    const router = require('@modules/payments/payment.routes');
    const app = express();
    app.use(express.json());
    app.use('/payments', router);
    server = await startServer(app);

    const address = server.address();
    const response = await sendJsonRequest({
      port: address.port,
      path: '/payments/deposits/initiate-upi',
      method: 'POST',
      body: { amount: 100 },
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      statusCode: 401,
      message: 'Authorization token missing',
    }));
  });
});
