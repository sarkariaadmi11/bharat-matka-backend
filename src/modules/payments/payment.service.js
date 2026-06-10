const crypto = require('crypto');
const https = require('https');
const mongoose = require('mongoose');
const { URLSearchParams } = require('url');
const config = require('@config');
const logger = require('@utils/logger');
const { RepositoryFactory } = require('@infra/database');
const { toPaise, toRupees } = require('@utils');
const { ValidationError, NotFoundError } = require('@utils/errors');
const { nowIST } = require('@utils/timezoneHelper');

const walletRepository = RepositoryFactory.getRepository('Wallet');
const paymentRepository = RepositoryFactory.getRepository('Payment');
const payoutRepository = RepositoryFactory.getRepository('Payout');
const transactionRepository = RepositoryFactory.getRepository('Transaction');
const bankDetailRepository = RepositoryFactory.getRepository('BankDetail');
const globalConfigRepository = RepositoryFactory.getRepository('GlobalConfig');

const UPI_SUCCESS_STATUSES = new Set(['SUCCESS', 'COMPLETED', 'PAID']);
const UPI_FAILURE_STATUSES = new Set(['FAILED', 'FAILURE', 'FAIL', 'CANCELLED', 'CANCELED']);
const UPI_PENDING_STATUSES = new Set(['PENDING', 'SUBMITTED', 'PROCESSING']);

const validateAmount = (amount) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new ValidationError('Amount must be greater than 0');
  }

  const amountPaise = numericAmount * 100;
  if (!Number.isInteger(Math.round(amountPaise)) || Math.abs(Math.round(amountPaise) - amountPaise) > 1e-8) {
    throw new ValidationError('Amount can have at most 2 decimal places');
  }

  return toPaise(numericAmount);
};

const enforceDepositLimits = async (amountInr) => {
  const config = await globalConfigRepository.getOrCreateActiveConfig();
  if (config.minimumDeposit !== undefined && config.minimumDeposit !== null && amountInr < config.minimumDeposit) {
    throw new ValidationError(`Minimum deposit amount is ${config.minimumDeposit}`);
  }
  if (config.maximumDeposit !== undefined && config.maximumDeposit !== null && amountInr > config.maximumDeposit) {
    throw new ValidationError(`Maximum deposit amount is ${config.maximumDeposit}`);
  }
};

const enforceWithdrawalLimits = async (amountInr) => {
  const config = await globalConfigRepository.getOrCreateActiveConfig();
  if (config.minimumWithdrawal !== undefined && config.minimumWithdrawal !== null && amountInr < config.minimumWithdrawal) {
    throw new ValidationError(`Minimum withdrawal amount is ${config.minimumWithdrawal}`);
  }
  if (config.maximumWithdrawal !== undefined && config.maximumWithdrawal !== null && amountInr > config.maximumWithdrawal) {
    throw new ValidationError(`Maximum withdrawal amount is ${config.maximumWithdrawal}`);
  }
};

const enforceWithdrawalTimeWindow = async () => {
  const config = await globalConfigRepository.getOrCreateActiveConfig();
  if (config.withdrawOpenTime && config.withdrawCloseTime) {
    const now = nowIST();
    const currentMinutes = now.hour * 60 + now.minute;
    const [openH, openM] = config.withdrawOpenTime.split(':').map(Number);
    const [closeH, closeM] = config.withdrawCloseTime.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;
    let withinWindow;
    if (openMinutes <= closeMinutes) {
      withinWindow = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } else {
      withinWindow = currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }
    if (!withinWindow) {
      throw new ValidationError(`Withdrawals are only allowed between ${config.withdrawOpenTime} and ${config.withdrawCloseTime}`);
    }
  }
};

const buildReferenceId = () => `ORDER_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const buildMerchantTxnId = () => `UPI_${Date.now()}_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

const ensureValidId = (id, label) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`Invalid ${label}`);
  }
};

const trimOptional = (value, { maxLength = 255, lowerCase = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  let normalized = String(value).trim();
  if (!normalized) {
    return undefined;
  }

  if (lowerCase) {
    normalized = normalized.toLowerCase();
  }

  return normalized.slice(0, maxLength);
};

const sanitizeRawValue = (value, depth = 0) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value.slice(0, 4000);
  }
  if (depth >= 5) {
    return '[Truncated]';
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeRawValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      acc[String(key).slice(0, 100)] = sanitizeRawValue(nestedValue, depth + 1);
      return acc;
    }, {});
  }
  return String(value).slice(0, 4000);
};

const normalizeClientStatus = (statusFromClient) => {
  const normalized = trimOptional(statusFromClient, { maxLength: 50 });
  if (!normalized) {
    throw new ValidationError('statusFromClient is required');
  }

  const upper = normalized.toUpperCase();
  if (UPI_SUCCESS_STATUSES.has(upper)) {
    return 'SUCCESS';
  }
  if (UPI_FAILURE_STATUSES.has(upper)) {
    return 'FAILED';
  }
  if (UPI_PENDING_STATUSES.has(upper)) {
    return 'PENDING';
  }
  return 'SUBMITTED';
};

const buildStatusMessage = (status) => {
  switch (status) {
    case 'pending':
      return 'Deposit created. Complete the payment in your UPI app.';
    case 'submitted':
      return 'Payment details submitted. Waiting for further confirmation.';
    case 'verifying':
      return 'Payment submitted. Verification is in progress.';
    case 'manual_review':
      return 'Payment reported by the client and is under manual review.';
    case 'success':
      return 'Wallet credited successfully.';
    case 'failed':
      return 'Payment failed or could not be verified.';
    default:
      return 'Deposit status updated.';
  }
};

const getWalletBalance = async (userId, session = null) => {
  if (!userId) {
    return null;
  }

  const wallet = await walletRepository.findByUserId(userId, session);
  return wallet?.balance ?? null;
};

const toDepositStatusPayload = ({ deposit, walletBalance = null, alreadyProcessed = false }) => ({
  depositId: String(deposit._id),
  amount: Number(toRupees(deposit.amount)),
  currency: deposit.currency,
  merchantTxnId: deposit.merchantTxnId || deposit.referenceId,
  status: deposit.status,
  verificationStatus: deposit.verificationStatus,
  clientStatus: deposit.clientStatus || null,
  credited: Boolean(deposit.creditedAt),
  alreadyProcessed,
  walletBalance: walletBalance === null ? null : Number(toRupees(walletBalance)),
  message: buildStatusMessage(deposit.status),
  createdAt: deposit.createdAt,
  updatedAt: deposit.updatedAt,
  creditedAt: deposit.creditedAt || null,
  failedAt: deposit.failedAt || null,
});

const toDepositSettlementPayload = ({ payment, walletBalance = null, alreadyProcessed = false }) => ({
  payment: {
    id: String(payment._id),
    userId: String(payment.userId),
    provider: payment.provider,
    transactionType: payment.transactionType,
    referenceId: payment.referenceId,
    paymentReference: payment.paymentReference,
    razorpayOrderId: payment.razorpayOrderId || null,
    razorpayPaymentId: payment.razorpayPaymentId || null,
    amount: Number(toRupees(payment.amount)),
    currency: payment.currency,
    status: payment.status,
    verificationStatus: payment.verificationStatus || null,
    paidAt: payment.paidAt || null,
    createdAt: payment.createdAt || null,
    updatedAt: payment.updatedAt || null,
  },
  balance: walletBalance === null ? null : Number(toRupees(walletBalance)),
  walletBalance: walletBalance === null ? null : Number(toRupees(walletBalance)),
  alreadyProcessed,
});

const toPayoutPayload = ({ payout, walletBalance = null }) => ({
  id: String(payout._id),
  userId: String(payout.userId),
  provider: payout.provider,
  amount: Number(toRupees(payout.amount)),
  currency: payout.currency,
  method: payout.method,
  status: payout.status,
  idempotencyKey: payout.idempotencyKey,
  reference: payout.reference || null,
  beneficiary: payout.beneficiary || {},
  failureReason: payout.failureReason || null,
  adminRemarks: payout.adminRemarks || null,
  adminApprovedBy: payout.adminApprovedBy ? String(payout.adminApprovedBy) : null,
  adminApprovedAt: payout.adminApprovedAt || null,
  processedAt: payout.processedAt || null,
  reversedAt: payout.reversedAt || null,
  createdAt: payout.createdAt || null,
  updatedAt: payout.updatedAt || null,
  walletBalance: walletBalance === null ? null : Number(toRupees(walletBalance)),
  canApprove: payout.status === 'pending',
  canReject: payout.status === 'pending',
});

const toTransactionLogPayload = (transaction) => {
  const document = transaction?.toObject?.() || transaction;

  return {
    ...document,
    amount: Number(toRupees(Math.abs(Number(document.amount || 0)))),
    balanceAfter: Number(toRupees(Number(document.balanceAfter || 0))),
    winAmount: document.winAmount === undefined ? document.winAmount : Number(toRupees(Number(document.winAmount || 0))),
  };
};

const toDepositHistoryItem = (transaction) => {
  const document = transaction?.toObject?.() || transaction;
  return {
    id: String(document._id),
    amount: Number(toRupees(Math.abs(Number(document.amount || 0)))),
    balanceAfter: Number(toRupees(Number(document.balanceAfter || 0))),
    provider: document.meta?.provider || null,
    paymentReference: document.meta?.paymentReference || document.meta?.merchantTxnId || null,
    referenceId: document.referenceId || null,
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
  };
};

const getRazorpayAuthHeader = () => {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) {
    throw new ValidationError('Razorpay credentials are not configured');
  }
  const encoded = Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64');
  return `Basic ${encoded}`;
};

const razorpayRequest = (path, options = {}) =>
  new Promise((resolve, reject) => {
    const body = options.body ? JSON.stringify(options.body) : null;
    const req = https.request(
      `https://api.razorpay.com/v1${path}`,
      {
        method: options.method || 'GET',
        headers: {
          Authorization: getRazorpayAuthHeader(),
          'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let payload = '';
        res.on('data', (chunk) => {
          payload += chunk;
        });
        res.on('end', () => {
          let data = {};
          try {
            data = payload ? JSON.parse(payload) : {};
          } catch {
            return reject(new ValidationError('Invalid response from Razorpay'));
          }

          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new ValidationError(data?.error?.description || 'Razorpay request failed'));
          }
          return resolve(data);
        });
      },
    );

    req.on('error', (error) => reject(error));
    if (body) {
      req.write(body);
    }
    req.end();
  });

const verifyWebhookSignature = (rawBody, signature) => {
  if (!rawBody || !signature || !config.RAZORPAY_WEBHOOK_SECRET) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  return expected === signature;
};

const verifyPaymentSignature = ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  if (
    !razorpay_order_id
    || !razorpay_payment_id
    || !razorpay_signature
    || !config.RAZORPAY_KEY_SECRET
  ) {
    return false;
  }

  const digest = crypto
    .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  return digest === razorpay_signature;
};

const getConfiguredMerchantUpiId = async () => {
  const activeConfig = await globalConfigRepository.getOrCreateActiveConfig();
  return trimOptional(activeConfig?.upiMerchantId, { maxLength: 100, lowerCase: true })
    || trimOptional(config.UPI_MERCHANT_ID, { maxLength: 100, lowerCase: true });
};

const getMerchantUpiConfig = async () => {
  const upiId = await getConfiguredMerchantUpiId();

  return {
    upiId: upiId || null,
    accountHolderName: trimOptional(config.UPI_MERCHANT_NAME, { maxLength: 100 }) || 'Merchant',
    isPrimary: true,
  };
};

const saveMerchantUpiConfig = async ({ upiId }) => {
  const normalizedUpiId = trimOptional(upiId, { maxLength: 100, lowerCase: true });
  if (!normalizedUpiId) {
    throw new ValidationError('upiId is required');
  }

  const activeConfig = await globalConfigRepository.getOrCreateActiveConfig();
  activeConfig.upiMerchantId = normalizedUpiId;
  await activeConfig.save();

  return getMerchantUpiConfig();
};

const buildUpiIntentPayload = async ({ merchantTxnId, amount }) => {
  const pa = await getConfiguredMerchantUpiId();
  if (!pa) {
    throw new ValidationError('UPI merchant ID is not configured');
  }

  const pn = trimOptional(config.UPI_MERCHANT_NAME, { maxLength: 100 }) || 'Merchant';
  const tr = merchantTxnId;
  const tn = `Wallet top-up ${merchantTxnId}`.slice(0, 80);
  const am = (amount / 100).toFixed(2);
  const cu = 'INR';
  const url = trimOptional(config.UPI_MERCHANT_URL || config.API_URI, { maxLength: 255 }) || '';

  const params = new URLSearchParams({
    pa,
    pn,
    tr,
    tn,
    am,
    cu,
  });

  if (url) {
    params.set('url', url);
  }

  return {
    pa,
    pn,
    tr,
    tn,
    am,
    cu,
    url,
    upiUrl: `upi://pay?${params.toString()}`,
  };
};

const createDepositOrder = async ({ userId, amount }) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }

  const amountPaise = validateAmount(amount);
  await enforceDepositLimits(Number(amount));
  const receipt = buildReferenceId();

  const order = await razorpayRequest('/orders', {
    method: 'POST',
    body: {
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId: String(userId),
        purpose: 'wallet_deposit',
      },
    },
  });

  const payment = await paymentRepository.create({
    userId,
    provider: 'razorpay',
    amount: amountPaise,
    currency: 'INR',
    status: 'pending',
    verificationStatus: 'pending',
    transactionType: 'deposit',
    referenceId: receipt,
    paymentReference: order.id,
    razorpayOrderId: order.id,
    receipt,
    meta: {
      source: 'razorpay_order_create',
    },
  });

  logger.info({
    message: 'Razorpay deposit order created',
    userId: String(userId),
    paymentId: String(payment._id),
    razorpayOrderId: order.id,
    amount: amountPaise,
  });

  return {
    paymentId: payment._id,
    orderId: order.id,
    keyId: config.RAZORPAY_KEY_ID,
    amount: Number(toRupees(order.amount)),
    currency: order.currency,
    receipt: order.receipt,
    status: payment.status,
  };
};

const initiateUpiDeposit = async ({ userId, amount }) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }

  const amountPaise = validateAmount(amount);
  await enforceDepositLimits(Number(amount));
  const merchantTxnId = buildMerchantTxnId();
  const upi = await buildUpiIntentPayload({
    merchantTxnId,
    amount: amountPaise,
  });

  const deposit = await paymentRepository.create({
    userId,
    provider: 'upi_intent',
    amount: amountPaise,
    currency: upi.cu,
    status: 'pending',
    verificationStatus: 'pending',
    transactionType: 'deposit',
    referenceId: merchantTxnId,
    merchantTxnId,
    paymentReference: merchantTxnId,
    meta: {
      source: 'upi_intent_initiate',
    },
  });

  logger.info({
    message: 'UPI intent deposit created',
    userId: String(userId),
    depositId: String(deposit._id),
    merchantTxnId,
    amount: amountPaise,
  });

  return {
    depositId: String(deposit._id),
    amount: Number(toRupees(deposit.amount)),
    currency: deposit.currency,
    merchantTxnId,
    upi,
  };
};

const fetchPaymentDetails = async (razorpayPaymentId) => {
  if (!razorpayPaymentId) {
    throw new ValidationError('Razorpay payment ID is required');
  }
  return razorpayRequest(`/payments/${razorpayPaymentId}`);
};

const verifyDepositPayment = async ({
  userId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }

  if (!verifyPaymentSignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  })) {
    throw new ValidationError('Invalid signature');
  }

  const payment = await paymentRepository.findByOrderId(razorpay_order_id);
  if (!payment) {
    throw new NotFoundError('Payment order not found');
  }

  if (String(payment.userId) !== String(userId)) {
    throw new ValidationError('Payment does not belong to user');
  }

  return finalizeCapturedPayment({
    order_id: razorpay_order_id,
    id: razorpay_payment_id,
  });
};

const finalizeCapturedPayment = async (paymentEntity) => {
  const razorpayOrderId = paymentEntity?.order_id;
  const razorpayPaymentId = paymentEntity?.id;

  if (!razorpayOrderId || !razorpayPaymentId) {
    throw new ValidationError('Invalid webhook payment payload');
  }

  const paymentDetails = await fetchPaymentDetails(razorpayPaymentId);
  if (paymentDetails.status !== 'captured') {
    throw new ValidationError('Payment is not captured at gateway');
  }
  if (paymentDetails.order_id !== razorpayOrderId) {
    throw new ValidationError('Order mismatch with gateway');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await paymentRepository.findByOrderId(razorpayOrderId, session);
    if (!payment) {
      throw new NotFoundError('Payment order not found');
    }

    if (payment.transactionType !== 'deposit') {
      throw new ValidationError('Invalid transaction type');
    }

    if (payment.status === 'success') {
      const walletBalance = await getWalletBalance(payment.userId, session);
      await session.commitTransaction();
      return toDepositSettlementPayload({
        payment,
        walletBalance,
        alreadyProcessed: true,
      });
    }

    if (!['pending', 'processing', 'failed'].includes(payment.status)) {
      throw new ValidationError('Deposit cannot be processed');
    }

    payment.status = 'processing';
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.method = paymentDetails.method;
    payment.meta = {
      ...(payment.meta || {}),
      capturedByWebhookAt: new Date().toISOString(),
      razorpayStatus: paymentDetails.status,
    };
    await payment.save({ session });

    const wallet = await walletRepository.creditBalance(
      payment.userId,
      payment.amount,
      'balance',
      session,
    );

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    await transactionRepository.recordDeposit(
      {
        userId: payment.userId,
        amount: payment.amount,
        balanceAfter: wallet.balance,
        referenceId: payment._id.toString(),
        meta: {
          provider: payment.provider,
          paymentReference: payment.paymentReference,
          razorpayOrderId,
          razorpayPaymentId,
          method: paymentDetails.method,
        },
      },
      session,
    );

    payment.status = 'success';
    payment.paidAt = new Date();
    payment.creditedAt = payment.creditedAt || new Date();
    payment.verificationStatus = 'verified';
    await payment.save({ session });

    await session.commitTransaction();

    logger.info({
      message: 'Razorpay deposit captured and wallet credited',
      userId: String(payment.userId),
      paymentId: String(payment._id),
      razorpayPaymentId,
      amount: payment.amount,
    });

    return {
      ...toDepositSettlementPayload({
        payment,
        walletBalance: wallet.balance,
        alreadyProcessed: false,
      }),
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const handleWebhookEvent = async ({ event, payload, rawBody, signature }) => {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new ValidationError('Invalid webhook signature');
  }

  if (event === 'payment.captured') {
    return finalizeCapturedPayment(payload?.payment?.entity);
  }

  if (event === 'payment.failed') {
    const paymentEntity = payload?.payment?.entity;
    const razorpayOrderId = paymentEntity?.order_id;
    if (!razorpayOrderId) {
      throw new ValidationError('Invalid failed payment payload');
    }

    const payment = await paymentRepository.findByOrderId(razorpayOrderId);
    if (!payment) {
      throw new NotFoundError('Payment order not found');
    }

    payment.status = 'failed';
    payment.razorpayPaymentId = paymentEntity?.id;
    payment.method = paymentEntity?.method;
    payment.failedAt = new Date();
    payment.meta = {
      ...(payment.meta || {}),
      failedByWebhookAt: new Date().toISOString(),
      gatewayError: paymentEntity?.error_description || null,
    };
    await payment.save();
    return { payment, failed: true };
  }

  return { ignored: true };
};

const submitUpiCallback = async ({
  userId,
  depositId,
  statusFromClient,
  txnRef,
  approvalRefNo,
  transactionId,
  responseCode,
  rawResponse,
}) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }

  ensureValidId(depositId, 'depositId');

  const normalizedStatus = normalizeClientStatus(statusFromClient);
  const sanitizedPayload = {
    depositId: String(depositId),
    statusFromClient: normalizedStatus,
    txnRef: trimOptional(txnRef, { maxLength: 100 }),
    approvalRefNo: trimOptional(approvalRefNo, { maxLength: 100 }),
    transactionId: trimOptional(transactionId, { maxLength: 100 }),
    responseCode: trimOptional(responseCode, { maxLength: 50 }),
    rawResponse: sanitizeRawValue(rawResponse),
    receivedAt: new Date().toISOString(),
  };

  const deposit = await paymentRepository.findDepositByIdAndUser(depositId, userId);
  if (!deposit) {
    throw new NotFoundError('Deposit not found');
  }

  if (deposit.provider !== 'upi_intent') {
    throw new ValidationError('Invalid deposit provider');
  }

  deposit.clientStatus = normalizedStatus;
  deposit.upiTxnRef = sanitizedPayload.txnRef || deposit.upiTxnRef;
  deposit.upiApprovalRefNo = sanitizedPayload.approvalRefNo || deposit.upiApprovalRefNo;
  deposit.upiTransactionId = sanitizedPayload.transactionId || deposit.upiTransactionId;
  deposit.rawCallbackPayload = sanitizedPayload;
  deposit.meta = {
    ...(deposit.meta || {}),
    latestUpiResponseCode: sanitizedPayload.responseCode || null,
  };

  const duplicateDeposit = await paymentRepository.findDuplicateUpiReference({
    excludeId: deposit._id,
    upiTxnRef: deposit.upiTxnRef,
    upiApprovalRefNo: deposit.upiApprovalRefNo,
    upiTransactionId: deposit.upiTransactionId,
  });

  if (duplicateDeposit) {
    deposit.meta = {
      ...(deposit.meta || {}),
      duplicateUpiReferenceDepositId: String(duplicateDeposit._id),
    };
  }

  if (deposit.creditedAt || deposit.status === 'success') {
    await deposit.save();
    const walletBalance = await getWalletBalance(userId);
    return toDepositStatusPayload({
      deposit,
      walletBalance,
      alreadyProcessed: true,
    });
  }

  if (normalizedStatus !== 'SUCCESS') {
    deposit.status = 'failed';
    deposit.verificationStatus = 'failed';
    deposit.failedAt = new Date();
    await deposit.save();

    logger.info({
      message: 'UPI deposit callback marked as failed',
      userId: String(userId),
      depositId: String(deposit._id),
      merchantTxnId: deposit.merchantTxnId,
      clientStatus: normalizedStatus,
    });

    return toDepositStatusPayload({ deposit });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await deposit.save({ session });

    const wallet = await walletRepository.creditBalance(
      deposit.userId,
      deposit.amount,
      'balance',
      session,
    );

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    await transactionRepository.recordDeposit(
      {
        userId: deposit.userId,
        amount: deposit.amount,
        balanceAfter: wallet.balance,
        referenceId: deposit._id.toString(),
        meta: {
          provider: deposit.provider,
          paymentReference: deposit.merchantTxnId,
          upiTxnRef: deposit.upiTxnRef || null,
          upiTransactionId: deposit.upiTransactionId || null,
        },
      },
      session,
    );

    deposit.status = 'success';
    deposit.verificationStatus = 'verified';
    deposit.paidAt = new Date();
    deposit.creditedAt = new Date();
    await deposit.save({ session });

    await session.commitTransaction();

    logger.info({
      message: 'UPI deposit credited to wallet',
      userId: String(userId),
      depositId: String(deposit._id),
      merchantTxnId: deposit.merchantTxnId,
      amount: deposit.amount,
    });

    return toDepositStatusPayload({ deposit, walletBalance: wallet.balance });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getUpiDepositStatus = async ({ userId, depositId }) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }

  ensureValidId(depositId, 'depositId');

  const deposit = await paymentRepository.findDepositByIdAndUser(depositId, userId);
  if (!deposit) {
    throw new NotFoundError('Deposit not found');
  }

  let walletBalance = null;
  if (deposit.creditedAt || deposit.status === 'success') {
    const wallet = await walletRepository.findByUserId(userId);
    walletBalance = wallet?.balance ?? null;
  }

  return toDepositStatusPayload({
    deposit,
    walletBalance,
  });
};

const requestWithdrawal = async ({
  userId,
  amount,
  method,
  bankAccountId,
  idempotencyKey,
}) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }

  const amountPaise = validateAmount(amount);
  await enforceWithdrawalLimits(Number(amount));
  await enforceWithdrawalTimeWindow();
  if (!bankAccountId) {
    throw new ValidationError('bankAccountId is required');
  }

  ensureValidId(bankAccountId, 'bankAccountId');

  const bankDetail = await bankDetailRepository.findByUserAndId(userId, bankAccountId);
  if (!bankDetail) {
    throw new NotFoundError('Bank account not found');
  }

  const wallet = await walletRepository.findByUserId(userId);
  if (!wallet) {
    throw new NotFoundError('Wallet not found');
  }
  if (wallet.balance < amountPaise) {
    throw new ValidationError('Insufficient balance');
  }

  const resolvedMethod = method || (bankDetail.upiId ? 'upi' : 'bank');
  if (!['upi', 'bank'].includes(resolvedMethod)) {
    throw new ValidationError('Invalid withdrawal method');
  }
  if (resolvedMethod === 'upi' && !bankDetail.upiId) {
    throw new ValidationError('Selected bank detail does not have a UPI ID');
  }
  if (
    resolvedMethod === 'bank'
    && (!bankDetail.accountNumber || !bankDetail.ifscCode || !bankDetail.bankName)
  ) {
    throw new ValidationError('Selected bank detail does not have bank account details');
  }

  const payoutKey = idempotencyKey || crypto.randomUUID();
  if (idempotencyKey) {
    const existing = await payoutRepository.findByIdempotencyKey(payoutKey);
    if (existing) {
      if (String(existing.userId) !== String(userId)) {
        throw new ValidationError('Idempotency key already used');
      }
      const existingWalletBalance = await getWalletBalance(userId);
      return toPayoutPayload({
        payout: existing,
        walletBalance: existingWalletBalance,
      });
    }
  }

  const payout = await payoutRepository.create({
    userId,
    provider: 'manual_withdrawal',
    amount: amountPaise,
    currency: 'INR',
    method: resolvedMethod,
    status: 'pending',
    idempotencyKey: payoutKey,
    reference: buildReferenceId(),
    beneficiary: {
      bankDetailId: bankDetail._id,
      upiId: bankDetail.upiId,
      bankAccount: bankDetail.accountNumber,
      ifsc: bankDetail.ifscCode,
      accountHolderName: bankDetail.accountHolderName,
      bankName: bankDetail.bankName,
    },
    meta: {
      bankDetailSnapshotAt: new Date().toISOString(),
    },
  });

  logger.info({
    message: 'Withdrawal requested',
    userId: String(userId),
    payoutId: String(payout._id),
    amount: amountPaise,
    method: resolvedMethod,
  });

  return toPayoutPayload({
    payout,
    walletBalance: wallet.balance,
  });
};

const approveWithdrawal = async ({ payoutId, adminUserId, adminRemarks }) => {
  ensureValidId(payoutId, 'payoutId');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payout = await payoutRepository.findOne({ _id: payoutId }, session);
    if (!payout) {
      throw new NotFoundError('Withdrawal request not found');
    }

    if (payout.status === 'approved') {
      const walletBalance = await getWalletBalance(payout.userId, session);
      await session.commitTransaction();
      return {
        alreadyProcessed: true,
        payout: toPayoutPayload({
          payout,
          walletBalance,
        }),
        balance: walletBalance === null ? null : Number(toRupees(walletBalance)),
      };
    }

    if (payout.status !== 'pending') {
      throw new ValidationError('Only pending withdrawals can be approved');
    }

    const wallet = await walletRepository.debitBalance(payout.userId, payout.amount, session);

    await transactionRepository.recordWithdrawalDebit(
      {
        userId: payout.userId,
        amount: payout.amount,
        balanceAfter: wallet.balance,
        referenceId: payout._id.toString(),
        meta: {
          method: payout.method,
          approvedBy: String(adminUserId),
        },
      },
      session,
    );

    payout.status = 'approved';
    payout.processedAt = new Date();
    payout.adminApprovedBy = adminUserId;
    payout.adminApprovedAt = new Date();
    payout.adminRemarks = adminRemarks || payout.adminRemarks;
    await payout.save({ session });

    await session.commitTransaction();

    logger.info({
      message: 'Withdrawal approved and wallet debited',
      adminUserId: String(adminUserId),
      userId: String(payout.userId),
      payoutId: String(payout._id),
      amount: payout.amount,
    });

    return {
      payout: toPayoutPayload({
        payout,
        walletBalance: wallet.balance,
      }),
      balance: Number(toRupees(wallet.balance)),
    };
  } catch (error) {
    await session.abortTransaction();
    if (error?.message?.toLowerCase().includes('insufficient balance')) {
      throw new ValidationError('Insufficient balance');
    }
    throw error;
  } finally {
    session.endSession();
  }
};

const rejectWithdrawal = async ({ payoutId, adminUserId, adminRemarks }) => {
  ensureValidId(payoutId, 'payoutId');
  const payout = await payoutRepository.findOne({ _id: payoutId });

  if (!payout) {
    throw new NotFoundError('Withdrawal request not found');
  }
  if (payout.status !== 'pending') {
    throw new ValidationError('Only pending withdrawals can be rejected');
  }

  payout.status = 'rejected';
  payout.failureReason = adminRemarks || 'Rejected by admin';
  payout.adminApprovedBy = adminUserId;
  payout.adminApprovedAt = new Date();
  payout.adminRemarks = adminRemarks || payout.adminRemarks;
  await payout.save();

  logger.warn({
    message: 'Withdrawal rejected',
    adminUserId: String(adminUserId),
    userId: String(payout.userId),
    payoutId: String(payout._id),
  });

  const walletBalance = await getWalletBalance(payout.userId);
  return toPayoutPayload({
    payout,
    walletBalance,
  });
};

const deleteWithdrawal = async ({ payoutId, adminUserId }) => {
  ensureValidId(payoutId, 'payoutId');
  const payout = await payoutRepository.findOne({ _id: payoutId });

  if (!payout) {
    throw new NotFoundError('Withdrawal request not found');
  }

  await payoutRepository.deleteById(payoutId);

  logger.info({
    message: 'Withdrawal request deleted',
    adminUserId: String(adminUserId),
    userId: String(payout.userId),
    payoutId: String(payout._id),
    amount: payout.amount,
  });

  return { deleted: true, payoutId: String(payout._id) };
};

const getWithdrawals = async ({ status, page = 1, limit = 20 }) =>
  payoutRepository.findForAdmin({ status, page, limit });

const getPaymentTransactionLogs = async ({ page = 1, limit = 20, userId }) => {
  const filter = {
    type: { $in: ['DEPOSIT', 'WITHDRAWAL_DEBIT', 'WITHDRAWAL_REVERSAL'] },
  };

  if (userId) {
    filter.userId = userId;
  }

  const { documents, pagination } = await transactionRepository.findByFilter(filter, page, limit);

  return {
    documents: documents.map(toTransactionLogPayload),
    pagination,
  };
};

const getDepositHistory = async ({ userId, page = 1, limit = 20, status }) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }

  const filter = { userId, type: 'DEPOSIT', status: { $ne: 'pending' } };
  if (status) {
    filter.$and = [{ status }, { status: { $ne: 'pending' } }];
    delete filter.status;
  }

  const { documents, pagination } = await transactionRepository.findByFilter(filter, page, limit);

  return {
    documents: documents.map(toDepositHistoryItem),
    pagination,
  };
};

const deleteDeposit = async ({ depositId, adminUserId }) => {
  ensureValidId(depositId, 'depositId');
  const deposit = await paymentRepository.findOne({ _id: depositId, transactionType: 'deposit' });

  if (!deposit) {
    throw new NotFoundError('Deposit not found');
  }

  await paymentRepository.deleteById(depositId);

  logger.info({
    message: 'Deposit deleted by admin',
    adminUserId: String(adminUserId),
    userId: String(deposit.userId),
    depositId: String(deposit._id),
    amount: deposit.amount,
  });

  return { deleted: true, depositId: String(deposit._id) };
};

const createAdminDeposit = async ({ userId, amount, adminUserId, adminRemarks }) => {
  ensureValidId(userId, 'userId');
  const amountPaise = validateAmount(amount);
  await enforceDepositLimits(Number(amount));

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const deposit = await paymentRepository.create(
      {
        userId,
        provider: 'admin_manual',
        transactionType: 'deposit',
        amount: amountPaise,
        currency: 'INR',
        status: 'success',
        verificationStatus: 'verified',
        referenceId: buildReferenceId(),
        adminApprovedBy: adminUserId,
        adminApprovedAt: new Date(),
        adminRemarks: adminRemarks || 'Admin manual deposit',
        creditedAt: new Date(),
        paidAt: new Date(),
        meta: { source: 'admin_manual' },
      },
      session,
    );

    const wallet = await walletRepository.creditBalance(userId, amountPaise, 'balance', session);
    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    await transactionRepository.recordDeposit(
      {
        userId,
        amount: amountPaise,
        balanceAfter: wallet.balance,
        referenceId: deposit._id.toString(),
        meta: {
          provider: 'admin_manual',
          adminUserId: String(adminUserId),
          adminRemarks: adminRemarks || 'Admin manual deposit',
        },
      },
      session,
    );

    await session.commitTransaction();

    logger.info({
      message: 'Admin manual deposit created',
      adminUserId: String(adminUserId),
      userId: String(userId),
      depositId: String(deposit._id),
      amount: amountPaise,
    });

    return {
      depositId: String(deposit._id),
      userId: String(userId),
      amount: Number(toRupees(amountPaise)),
      balance: Number(toRupees(wallet.balance)),
      status: deposit.status,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getAdminDepositHistory = async ({ page = 1, limit = 20 }) => {
  const { documents, pagination } = await transactionRepository.findByFilter(
    { type: 'DEPOSIT' },
    page,
    limit,
  );

  const populatedDocuments = await Promise.all(
    documents.map(async (document) => {
      await document.populate('userId', 'username phone email');
      return document;
    }),
  );

  return {
    documents: populatedDocuments.map((transaction) => {
      const item = toDepositHistoryItem(transaction);
      const user = transaction.userId && typeof transaction.userId === 'object'
        ? transaction.userId
        : null;

      return {
        ...item,
        userId: user?._id ? String(user._id) : null,
        username: user?.username || null,
        phone: user?.phone || null,
        email: user?.email || null,
      };
    }),
    pagination,
  };
};

module.exports = {
  createDepositOrder,
  initiateUpiDeposit,
  getMerchantUpiConfig,
  saveMerchantUpiConfig,
  submitUpiCallback,
  getUpiDepositStatus,
  verifyPaymentSignature,
  verifyDepositPayment,
  handleWebhookEvent,
  requestWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  deleteWithdrawal,
  getWithdrawals,
  getPaymentTransactionLogs,
  getDepositHistory,
  getAdminDepositHistory,
  deleteDeposit,
  createAdminDeposit,
};
