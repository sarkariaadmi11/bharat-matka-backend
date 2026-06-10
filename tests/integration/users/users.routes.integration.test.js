const express = require('express');
const http = require('http');

describe('users routes auth', () => {
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

  const sendRequest = async ({ port, path, auth = null }) =>
    await new Promise((resolve, reject) => {
      const request = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET',
          headers: auth ? { authorization: auth } : {},
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

    jest.doMock('@modules/users/users.controller', () => ({
      getProfile: (_req, res) => res.status(200).json({ ok: true }),
      getWallet: (_req, res) => res.status(200).json({ ok: true }),
      getTransactions: (_req, res) => res.status(200).json({ ok: true }),
      getDepositHistory: (_req, res) => res.status(200).json({ ok: true }),
      getWithdrawalHistory: (_req, res) => res.status(200).json({ ok: true }),
    }));

    jest.doMock('@modules/bets/bets.controller', () => ({
      getMyBets: (_req, res) => res.status(200).json({ ok: true }),
    }));
  });

  afterEach(async () => {
    if (server) {
      await stopServer(server);
      server = null;
    }
  });

  test('rejects unauthorized /my/deposits request', async () => {
    const router = require('@modules/users/users.routes');
    const app = express();
    app.use('/api', router);
    server = await startServer(app);

    const address = server.address();
    const response = await sendRequest({
      port: address.port,
      path: '/api/my/deposits',
    });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Authorization token missing');
  });

  test('rejects unauthorized /my/withdrawals request', async () => {
    const router = require('@modules/users/users.routes');
    const app = express();
    app.use('/api', router);
    server = await startServer(app);

    const address = server.address();
    const response = await sendRequest({
      port: address.port,
      path: '/api/my/withdrawals',
    });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Authorization token missing');
  });

  test('allows authorized /my/deposits request', async () => {
    const router = require('@modules/users/users.routes');
    const app = express();
    app.use('/api', router);
    server = await startServer(app);

    const address = server.address();
    const response = await sendRequest({
      port: address.port,
      path: '/api/my/deposits',
      auth: 'Bearer token',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test('allows authorized /my/withdrawals request', async () => {
    const router = require('@modules/users/users.routes');
    const app = express();
    app.use('/api', router);
    server = await startServer(app);

    const address = server.address();
    const response = await sendRequest({
      port: address.port,
      path: '/api/my/withdrawals',
      auth: 'Bearer token',
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
