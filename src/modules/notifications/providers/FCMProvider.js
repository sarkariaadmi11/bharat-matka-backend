const admin = require('firebase-admin');

const MAX_TOKENS_PER_BATCH = 500;

class FCMProvider {
  constructor({ config, logger }) {
    this.config = config;
    this.logger = logger;
    this.isEnabled = false;
    this.isInitialized = false;

    this._initialize();
  }

  _initialize() {
    const serviceAccount = this._loadServiceAccount();

    if (!serviceAccount) {
      this.logger.warn({
        message: 'FCM is disabled (missing Firebase service account credentials)',
      });
      return;
    }

    try {
      if (!admin.apps || admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
      this.isEnabled = true;
      this.isInitialized = true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to initialize Firebase Admin SDK',
        error,
      });
      this.isEnabled = false;
      this.isInitialized = false;
    }
  }

  _loadServiceAccount() {
    const rawJson = this.config.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawJson) {
      try {
        const jsonString = rawJson.trim().startsWith('{')
          ? rawJson
          : Buffer.from(rawJson, 'base64').toString('utf8');
        return JSON.parse(jsonString);
      } catch (error) {
        this.logger.error({
          message: 'Invalid FIREBASE_SERVICE_ACCOUNT_JSON',
          error,
        });
        return null;
      }
    }

    const projectId = this.config.FIREBASE_PROJECT_ID;
    const clientEmail = this.config.FIREBASE_CLIENT_EMAIL;
    const privateKey = this._normalizePrivateKey(this.config.FIREBASE_PRIVATE_KEY);
    const type = this.config.FIREBASE_TYPE || 'service_account';
    const privateKeyId = this.config.FIREBASE_PRIVATE_KEY_ID;
    const clientId = this.config.FIREBASE_CLIENT_ID;
    const authUri = this.config.FIREBASE_AUTH_URI;
    const tokenUri = this.config.FIREBASE_TOKEN_URI;
    const authProviderX509CertUrl = this.config.FIREBASE_AUTH_PROVIDER_X509_CERT_URL;
    const clientX509CertUrl = this.config.FIREBASE_CLIENT_X509_CERT_URL;
    const universeDomain = this.config.FIREBASE_UNIVERSE_DOMAIN;

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    return {
      type,
      projectId,
      private_key_id: privateKeyId,
      clientEmail,
      client_id: clientId,
      auth_uri: authUri,
      token_uri: tokenUri,
      auth_provider_x509_cert_url: authProviderX509CertUrl,
      client_x509_cert_url: clientX509CertUrl,
      universe_domain: universeDomain,
      privateKey,
    };
  }

  _normalizePrivateKey(privateKey) {
    if (!privateKey) {
      return null;
    }
    return privateKey.replace(/\\n/g, '\n');
  }

  async sendToTokens({
    tokens,
    notification,
    data,
    android,
    apns,
    webpush,
    dryRun = false,
  }) {
    if (!this.isEnabled || !this.isInitialized) {
      return {
        skipped: true,
        successCount: 0,
        failureCount: 0,
        responses: [],
      };
    }

    if (!Array.isArray(tokens) || tokens.length === 0) {
      return {
        skipped: true,
        successCount: 0,
        failureCount: 0,
        responses: [],
      };
    }

    const normalizedData = data
      ? Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)]),
      )
      : undefined;

    const batches = [];
    for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_BATCH) {
      batches.push(tokens.slice(i, i + MAX_TOKENS_PER_BATCH));
    }

    let successCount = 0;
    let failureCount = 0;
    const responses = [];

    for (const batchTokens of batches) {
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: batchTokens,
          notification,
          data: normalizedData,
          android,
          apns,
          webpush,
          dryRun,
        });

        successCount += response.successCount;
        failureCount += response.failureCount;

        response.responses.forEach((res, index) => {
          responses.push({
            token: batchTokens[index],
            success: res.success,
            error: res.error || null,
          });
        });
      } catch (error) {
        this.logger.error({
          message: 'FCM send failure (batch)',
          error,
        });
      }
    }

    return {
      skipped: false,
      successCount,
      failureCount,
      responses,
    };
  }
}

module.exports = FCMProvider;
