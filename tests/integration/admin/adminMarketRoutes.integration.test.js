const listRoutePaths = (router) => (
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }))
);

describe('admin market route exposure', () => {
  beforeEach(() => {
    jest.resetModules();

    jest.doMock('@middleware/auth', () => ({
      requireAdminAuth: [(_req, _res, next) => next()],
    }));

    jest.doMock('@middleware/rateLimiter', () => ({
      userLimiter: (_req, _res, next) => next(),
    }));

    jest.doMock('../../../src/modules/admin/markets/adminMarkets.controller', () => ({
      createMarket: jest.fn(),
      getMarkets: jest.fn(),
      updateMarket: jest.fn(),
      deleteMarket: jest.fn(),
      getMarketGameTypes: jest.fn(),
    }));
  });

  test('admin market router exposes create, list, game-types, update, and soft delete endpoints', () => {
    const router = require('@modules/admin/markets/adminMarkets.routes');
    const routes = listRoutePaths(router);

    expect(routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: '/', methods: expect.arrayContaining(['get']) }),
      expect.objectContaining({ path: '/', methods: expect.arrayContaining(['post']) }),
      expect.objectContaining({ path: '/:marketId/gametypes', methods: expect.arrayContaining(['get']) }),
      expect.objectContaining({ path: '/:marketId', methods: expect.arrayContaining(['patch']) }),
      expect.objectContaining({ path: '/:marketId', methods: expect.arrayContaining(['delete']) }),
    ]));
  });
});
