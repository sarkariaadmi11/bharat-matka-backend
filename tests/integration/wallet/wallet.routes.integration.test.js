const express = require('express');
const http = require('http');

describe('wallet routes auth', () => {
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

  const sendRequest = async ({ port, path, method, body }) =>
    await new Promise((resolve, reject) => {
      const payload = body === undefined ? null : JSON.stringify(body);
      const request = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: payload ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          } : {},
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
      if (payload) {
        request.write(payload);
      }
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
      requireAdmin: (_req, _res, next) => next(),
    }));

    jest.doMock('@middleware/rateLimiter', () => ({
      userLimiter: (_req, _res, next) => next(),
    }));

    jest.doMock('@modules/wallet/wallet.controller', () => ({
      getWallet: (_req, res) => res.status(200).json({ ok: true }),
      getTransactions: (_req, res) => res.status(200).json({ ok: true }),
      adminCredit: (_req, res) => res.status(200).json({ ok: true }),
    }));

    jest.doMock('@modules/wallet/wallet.bank.controller', () => ({
      addBankAccount: (_req, res) => res.status(201).json({ ok: true }),
      listBankAccounts: (_req, res) => res.status(200).json({ ok: true }),
      getUpiAccount: (_req, res) => res.status(200).json({ ok: true }),
      upsertUpiAccount: (_req, res) => res.status(200).json({ ok: true }),
      deleteBankAccount: (_req, res) => res.status(200).json({ ok: true }),
    }));
  });

  afterEach(async () => {
    if (server) {
      await stopServer(server);
      server = null;
    }
  });

  test('rejects unauthorized get upi-account request', async () => {
    const router = require('@modules/wallet/wallet.routes');
    const app = express();
    app.use(express.json());
    app.use('/wallet', router);
    server = await startServer(app);

    const address = server.address();
    const response = await sendRequest({
      port: address.port,
      path: '/wallet/upi-account',
      method: 'GET',
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      statusCode: 401,
      message: 'Authorization token missing',
    }));
  });

  test('rejects unauthorized create upi-account request', async () => {
    const router = require('@modules/wallet/wallet.routes');
    const app = express();
    app.use(express.json());
    app.use('/wallet', router);
    server = await startServer(app);

    const address = server.address();
    const response = await sendRequest({
      port: address.port,
      path: '/wallet/upi-account',
      method: 'POST',
      body: { accountHolderName: 'Demo User', upiId: 'demo@upi' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      statusCode: 401,
      message: 'Authorization token missing',
    }));
  });
});
