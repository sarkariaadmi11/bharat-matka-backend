const DEPOSIT_PROVIDER = Object.freeze({
  RAZORPAY: 'razorpay',
  UPI_INTENT: 'upi_intent',
  ADMIN_MANUAL: 'admin_manual',
  MANUAL_WITHDRAWAL: 'manual_withdrawal',
});

const DEPOSIT_STATUS = Object.freeze({
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  VERIFYING: 'verifying',
  MANUAL_REVIEW: 'manual_review',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
});

const DEPOSIT_VERIFICATION_STATUS = Object.freeze({
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  VERIFYING: 'verifying',
  VERIFIED: 'verified',
  MANUAL_REVIEW: 'manual_review',
  FAILED: 'failed',
});

const WITHDRAWAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  REVERSED: 'reversed',
});

const WITHDRAWAL_METHOD = Object.freeze({
  UPI: 'upi',
  BANK: 'bank',
});

module.exports = {
  DEPOSIT_PROVIDER,
  DEPOSIT_STATUS,
  DEPOSIT_VERIFICATION_STATUS,
  WITHDRAWAL_STATUS,
  WITHDRAWAL_METHOD,
};
