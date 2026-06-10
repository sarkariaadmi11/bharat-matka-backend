const BaseRepository = require('./baseRepository');
const { Payment } = require('@infra/models');

const PAYMENT_HISTORY_PROJECTION = [
  '_id',
  'provider',
  'amount',
  'currency',
  'status',
  'verificationStatus',
  'paymentReference',
  'clientStatus',
  'adminRemarks',
  'paidAt',
  'creditedAt',
  'failedAt',
  'createdAt',
  'updatedAt',
].join(' ');

class PaymentRepository extends BaseRepository {
  constructor() {
    super(Payment);
  }

  async findDepositByIdAndUser(id, userId, session = null) {
    return await this.model.findOne({
      _id: id,
      userId,
      transactionType: 'deposit',
    }).session(session);
  }

  async findByReferenceId(referenceId, session = null) {
    return await this.model.findOne({ referenceId }).session(session);
  }

  async findByMerchantTxnId(merchantTxnId, session = null) {
    return await this.model.findOne({ merchantTxnId }).session(session);
  }

  async findByUpiTransactionId(upiTransactionId, session = null) {
    return await this.model.findOne({ upiTransactionId }).session(session);
  }

  async findByUpiApprovalRefNo(upiApprovalRefNo, session = null) {
    return await this.model.findOne({ upiApprovalRefNo }).session(session);
  }

  async findByUpiTxnRef(upiTxnRef, session = null) {
    return await this.model.findOne({ upiTxnRef }).session(session);
  }

  async findByOrderId(razorpayOrderId, session = null) {
    return await this.model.findOne({ razorpayOrderId }).session(session);
  }

  async findByPaymentId(razorpayPaymentId, session = null) {
    return await this.model.findOne({ razorpayPaymentId }).session(session);
  }

  async findDuplicateUpiReference({
    excludeId,
    upiTxnRef,
    upiApprovalRefNo,
    upiTransactionId,
  }, session = null) {
    const or = [
      upiTxnRef ? { upiTxnRef } : null,
      upiApprovalRefNo ? { upiApprovalRefNo } : null,
      upiTransactionId ? { upiTransactionId } : null,
    ].filter(Boolean);

    if (or.length === 0) {
      return null;
    }

    const filter = {
      _id: { $ne: excludeId },
      transactionType: 'deposit',
      $or: or,
    };

    return await this.model.findOne(filter).session(session);
  }

  async claimUpiDepositForCredit({ depositId, userId }, session = null) {
    return await this.model.findOneAndUpdate(
      {
        _id: depositId,
        userId,
        provider: 'upi_intent',
        transactionType: 'deposit',
        creditedAt: null,
        status: { $in: ['pending', 'submitted', 'verifying', 'manual_review'] },
      },
      {
        $set: {
          status: 'verifying',
          verificationStatus: 'verifying',
        },
      },
      {
        new: true,
        session,
      },
    );
  }

  buildUserDepositHistoryFilter(userId, options = {}) {
    const filter = {
      userId,
      transactionType: 'deposit',
    };

    if (options.status) {
      filter.status = options.status;
    }

    if (options.provider) {
      filter.provider = options.provider;
    }

    const createdAt = {};

    if (options.fromDate) {
      createdAt.$gte = options.fromDate;
    }

    if (options.toDate) {
      createdAt.$lte = options.toDate;
    }

    if (Object.keys(createdAt).length > 0) {
      filter.createdAt = createdAt;
    }

    return filter;
  }

  async getUserDepositHistory(userId, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;
    const filter = this.buildUserDepositHistoryFilter(userId, options);

    const documents = await this.model
      .find(filter)
      .select(PAYMENT_HISTORY_PROJECTION)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await this.model.countDocuments(filter);

    return {
      documents,
      meta: {
        page,
        limit,
        total,
      },
    };
  }
}

module.exports = PaymentRepository;
