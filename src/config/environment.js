require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

const normalizeEnvValue = (value) => {
  if (value === undefined || value === null) {
    return value;
  }

  let normalized = String(value).trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"'))
    || (normalized.startsWith('\'') && normalized.endsWith('\''))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  if (normalized.endsWith(',')) {
    normalized = normalized.slice(0, -1).trim();
  }

  return normalized;
};

const firebaseProjectId = normalizeEnvValue(process.env.FIREBASE_PROJECT_ID);
const firebaseClientEmail = normalizeEnvValue(process.env.FIREBASE_CLIENT_EMAIL);
const firebasePrivateKey = normalizeEnvValue(process.env.FIREBASE_PRIVATE_KEY);
const firebasePrivateKeyId = normalizeEnvValue(process.env.FIREBASE_PRIVATE_KEY_ID);
const firebaseClientId = normalizeEnvValue(process.env.FIREBASE_CLIENT_ID);
const firebaseType = normalizeEnvValue(process.env.FIREBASE_TYPE);
const firebaseAuthUri = normalizeEnvValue(process.env.FIREBASE_AUTH_URI);
const firebaseTokenUri = normalizeEnvValue(process.env.FIREBASE_TOKEN_URI);
const firebaseAuthProviderCertUrl = normalizeEnvValue(process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL);
const firebaseClientCertUrl = normalizeEnvValue(process.env.FIREBASE_CLIENT_X509_CERT_URL);
const firebaseUniverseDomain = normalizeEnvValue(process.env.FIREBASE_UNIVERSE_DOMAIN);
const firebaseRawServiceAccountJson = normalizeEnvValue(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

module.exports = {
  NODE_ENV,
  PORT: process.env.PORT || 5000,
  LOG_LEVEL: process.env.LOG_LEVEL,
  API_VERSION: process.env.API_VERSION || 'v1',
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN,
  API_URI: process.env.API_URI,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  UPI_MERCHANT_ID: process.env.UPI_MERCHANT_ID || '34535345@ucobank',
  UPI_MERCHANT_NAME: process.env.UPI_MERCHANT_NAME || 'Merchant',
  UPI_MERCHANT_URL: process.env.UPI_MERCHANT_URL,
  UPI_VERIFICATION_MODE: process.env.UPI_VERIFICATION_MODE || 'disabled',
  UPI_MOCK_VERIFICATION_RESULT: process.env.UPI_MOCK_VERIFICATION_RESULT,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  LOG_RETENTION_DAYS: process.env.LOG_RETENTION_DAYS,
  LOG_CLEANUP_INTERVAL_HOURS: process.env.LOG_CLEANUP_INTERVAL_HOURS,
  FIREBASE_PROJECT_ID: firebaseProjectId,
  FIREBASE_CLIENT_EMAIL: firebaseClientEmail,
  FIREBASE_PRIVATE_KEY: firebasePrivateKey,
  FIREBASE_TYPE: firebaseType,
  FIREBASE_PRIVATE_KEY_ID: firebasePrivateKeyId,
  FIREBASE_CLIENT_ID: firebaseClientId,
  FIREBASE_AUTH_URI: firebaseAuthUri,
  FIREBASE_TOKEN_URI: firebaseTokenUri,
  FIREBASE_AUTH_PROVIDER_X509_CERT_URL: firebaseAuthProviderCertUrl,
  FIREBASE_CLIENT_X509_CERT_URL: firebaseClientCertUrl,
  FIREBASE_UNIVERSE_DOMAIN: firebaseUniverseDomain,
  FIREBASE_SERVICE_ACCOUNT_JSON: firebaseRawServiceAccountJson,
  FIREBASE_SERVICE_ACCOUNT_PATH: undefined,
  ANALYTICS_DASHBOARD_CACHE_TTL_SECONDS: Number(process.env.ANALYTICS_DASHBOARD_CACHE_TTL_SECONDS || 15),
  ANALYTICS_MAX_LIMIT: Number(process.env.ANALYTICS_MAX_LIMIT || 100),
  ANALYTICS_DEFAULT_LIMIT: Number(process.env.ANALYTICS_DEFAULT_LIMIT || 20),
  ANALYTICS_MAX_RANGE_DAYS: Number(process.env.ANALYTICS_MAX_RANGE_DAYS || 30),
  ANALYTICS_DEFAULT_RANGE_DAYS: Number(process.env.ANALYTICS_DEFAULT_RANGE_DAYS || 7),
  API_DOC_USERNAME: normalizeEnvValue(process.env.API_DOC_USERNAME),
  API_DOC_PASSWORD: normalizeEnvValue(process.env.API_DOC_PASSWORD),
};

