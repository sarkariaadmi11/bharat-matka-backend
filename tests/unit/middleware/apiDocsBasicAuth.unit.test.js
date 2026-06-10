describe('apiDocsBasicAuth middleware', () => {
  const createResponse = () => {
    const res = {
      headers: {},
      statusCode: 200,
      body: null,
      set: jest.fn((key, value) => {
        res.headers[key] = value;
        return res;
      }),
      status: jest.fn((code) => {
        res.statusCode = code;
        return res;
      }),
      json: jest.fn((payload) => {
        res.body = payload;
        return res;
      }),
    };

    return res;
  };

  beforeEach(() => {
    jest.resetModules();
  });

  test('allows request when credentials match configured values', () => {
    jest.doMock('@config', () => ({
      API_DOC_USERNAME: 'docs-user',
      API_DOC_PASSWORD: 'docs-pass',
    }));

    const { apiDocsBasicAuth } = require('@middleware/apiDocsBasicAuth');
    const req = {
      headers: {
        authorization: `Basic ${Buffer.from('docs-user:docs-pass').toString('base64')}`,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    apiDocsBasicAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 401 when credentials are missing', () => {
    jest.doMock('@config', () => ({
      API_DOC_USERNAME: 'docs-user',
      API_DOC_PASSWORD: 'docs-pass',
    }));

    const { apiDocsBasicAuth } = require('@middleware/apiDocsBasicAuth');
    const res = createResponse();

    apiDocsBasicAuth({ headers: {} }, res, jest.fn());

    expect(res.statusCode).toBe(401);
    expect(res.headers['WWW-Authenticate']).toContain('Basic');
  });

  test('returns 503 when credentials are not configured', () => {
    jest.doMock('@config', () => ({
      API_DOC_USERNAME: '',
      API_DOC_PASSWORD: '',
    }));

    const { apiDocsBasicAuth } = require('@middleware/apiDocsBasicAuth');
    const res = createResponse();

    apiDocsBasicAuth({ headers: {} }, res, jest.fn());

    expect(res.statusCode).toBe(503);
    expect(res.body.message).toContain('not configured');
  });
});
