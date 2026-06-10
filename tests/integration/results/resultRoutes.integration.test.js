const listRoutePaths = (router) =>
  router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);

describe('result route exposure', () => {
  beforeEach(() => {
    jest.resetModules();

    jest.doMock('@middleware/auth', () => ({
      requireAdminAuth: [(_req, _res, next) => next()],
      requireAuth: (_req, _res, next) => next(),
      requireAdmin: (_req, _res, next) => next(),
    }));

    jest.doMock('@middleware/rateLimiter', () => ({
      userLimiter: (_req, _res, next) => next(),
    }));

    jest.doMock('../../../src/modules/admin/results/result.controller', () => ({
      declareOpenResult: jest.fn(),
      declareCloseResult: jest.fn(),
      resetOpenResult: jest.fn(),
      resetCloseResult: jest.fn(),
      previewWinnersForResult: jest.fn(),
    }));

    jest.doMock(
      '../../../src/modules/admin/results/revertBatch.controller',
      () => ({
        createAndExecuteRevertBatch: jest.fn(),
        listRevertBatches: jest.fn(),
        getRevertBatchStatus: jest.fn(),
        listBidHistory: jest.fn(),
        createAndEnqueueRevertAll: jest.fn(),
      }),
    );

    jest.doMock(
      '../../../src/modules/admin/simulation/resultSimulation.controller',
      () => ({
        simulateResults: jest.fn(),
      }),
    );

    jest.doMock('./../../../src/modules/sessions/sessions.controller', () => ({
      createDailySessions: jest.fn(),
      getDailySessionCreationStatus: jest.fn(),
      getAllSessions: jest.fn(),
      getActiveSessionForMarket: jest.fn(),
      getSessionById: jest.fn(),
      lockSession: jest.fn(),
      getMarketStatusSummary: jest.fn(),
      getSessionsByDate: jest.fn(),
      getAdminSessionsOverview: jest.fn(),
    }));
  });

  test('admin result router exposes open, close, reset, and simulate endpoints', () => {
    const router = require('@modules/admin/results/result.routes');
    const paths = listRoutePaths(router);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/sessions/:sessionId/open',
        '/sessions/:sessionId/close',
        '/sessions/:sessionId/reset-open',
        '/sessions/:sessionId/reset-close',
        '/sessions/:sessionId/simulate',
      ]),

    );
    expect(paths).not.toContain('/sessions/:sessionId/declare');
  });

  test('admin result router exposes revert-all and bid-history endpoints', () => {
    const router = require('@modules/admin/results/result.routes');
    const paths = listRoutePaths(router);

    expect(paths).toEqual(expect.arrayContaining([
      '/bid-history',
      '/sessions/:sessionId/revert-all',
      '/sessions/:sessionId/revert-batches',
      '/revert-batches/:batchId',
    ]));
  });

  test('sessions router does not expose result declaration endpoints', () => {
    const router = require('@modules/sessions/sessions.routes');
    const paths = listRoutePaths(router);

    expect(paths).not.toContain('/:sessionId/declare-open');
  });
});
