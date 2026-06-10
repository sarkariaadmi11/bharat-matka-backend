describe('utils/token.generateTokens', () => {
  let generateTokens;
  let jwt;

  beforeEach(() => {
    jest.resetModules();

    jest.doMock('@config', () => ({
      JWT_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    }));

    jwt = require('jsonwebtoken');
    ({ generateTokens } = require('../../../src/utils/token'));
  });

  test('includes normalized roles claim in the access token', () => {
    const { accessToken } = generateTokens({
      _id: '507f1f77bcf86cd799439011',
      role: 'admin',
      roles: ['admin', 'superadmin'],
    });

    const decoded = jwt.verify(accessToken, 'access-secret');

    expect(decoded).toEqual(expect.objectContaining({
      sub: '507f1f77bcf86cd799439011',
      roles: ['ADMIN', 'SUPERADMIN'],
    }));
  });
});
