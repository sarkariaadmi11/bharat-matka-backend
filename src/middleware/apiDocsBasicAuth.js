const config = require('@config');

const API_DOCS_REALM = 'API Documentation';
const BASIC_AUTH_SCHEME = 'Basic';
const AUTHORIZATION_HEADER = 'authorization';

const buildUnauthorizedResponse = (res, message) => {
  res.set('WWW-Authenticate', `${BASIC_AUTH_SCHEME} realm="${API_DOCS_REALM}"`);
  return res.status(401).json({
    success: false,
    statusCode: 401,
    message,
    timestamp: new Date().toISOString(),
  });
};

const apiDocsBasicAuth = (req, res, next) => {
  const configuredUsername = config.API_DOC_USERNAME;
  const configuredPassword = config.API_DOC_PASSWORD;

  if (!configuredUsername || !configuredPassword) {
    return res.status(503).json({
      success: false,
      statusCode: 503,
      message: 'API documentation credentials are not configured.',
      timestamp: new Date().toISOString(),
    });
  }

  const authorizationHeader = req.headers[AUTHORIZATION_HEADER];
  if (!authorizationHeader || !authorizationHeader.startsWith(`${BASIC_AUTH_SCHEME} `)) {
    return buildUnauthorizedResponse(res, 'Authentication required.');
  }

  const encodedCredentials = authorizationHeader.slice(BASIC_AUTH_SCHEME.length + 1).trim();
  let decodedCredentials;

  try {
    decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf8');
  } catch {
    return buildUnauthorizedResponse(res, 'Invalid authentication header.');
  }

  const separatorIndex = decodedCredentials.indexOf(':');
  if (separatorIndex === -1) {
    return buildUnauthorizedResponse(res, 'Invalid authentication credentials.');
  }

  const username = decodedCredentials.slice(0, separatorIndex);
  const password = decodedCredentials.slice(separatorIndex + 1);

  if (username !== configuredUsername || password !== configuredPassword) {
    return buildUnauthorizedResponse(res, 'Invalid authentication credentials.');
  }

  return next();
};

module.exports = {
  apiDocsBasicAuth,
};
