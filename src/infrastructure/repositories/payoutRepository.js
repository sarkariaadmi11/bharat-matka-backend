const BaseRepository = require('./baseRepository');
const { Payout } = require('@infra/models');
const { toRupees } = require('@utils');

const PAYOUT_HISTORY_PROJECTION = [
  '_id',
  'provider',
  'amount',
  'currency',
  'method',
  'status',
  'beneficiary.accountHolderName',
  'beneficiary.bankName',
  'beneficiary.bankAccount',
  'beneficiary.upiId',
  'failureReason',
  'adminRemarks',
  'processedAt',
  'reversedAt',
  'createdAt',
  'updatedAt',
].join(' ');

class PayoutRepository extends BaseRepository {
  constructor() {
    super(Payout);
  }

  async findByIdempotencyKey(idempotencyKey, session = null) {
    return await this.model.findOne({ idempotencyKey }).session(session);
  }

  async findByRazorpayPayoutId(razorpayPayoutId, session = null) {
    return await this.model.findOne({ razorpayPayoutId }).session(session);
  }

  async findForAdmin({ status = null, page = 1, limit = 20 }) {
    const filter = {};
    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;
    const documents = await this.model
      .find(filter)
      .populate('userId', 'username phone email')
      .populate('beneficiary.bankDetailId')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit);

    const total = await this.model.countDocuments(filter);
    return {
      documents: documents.map((document) => {
        const user = document.userId && typeof document.userId === 'object' ? document.userId : null;
        return {
          id: String(document._id),
          userId: user?._id ? String(user._id) : null,
          username: user?.username || null,
          phone: user?.phone || null,
          email: user?.email || null,
          amount: Number(toRupees(document.amount)),
          bankAccount: document.beneficiary?.bankAccount
            ? `XXXX${String(document.beneficiary.bankAccount).slice(-4)}`
            : null,
          upiId: document.beneficiary?.upiId || null,
          method: document.method,
          status: document.status,
          reference: document.reference || null,
          requestedAt: document.createdAt,
          processedAt: document.processedAt || null,
          canApprove: document.status === 'pending',
          canReject: document.status === 'pending',
          adminRemarks: document.adminRemarks || null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async countPendingByBankDetail(bankDetailId) {
    return this.model.countDocuments({
      'beneficiary.bankDetailId': bankDetailId,
      status: { $in: ['pending', 'processing'] },
    });
  }

  buildUserWithdrawalHistoryFilter(userId, options = {}) {
    const filter = { userId };

    if (options.status) {
      filter.status = options.status;
    }

    if (options.method) {
      filter.method = options.method;
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

  async getUserWithdrawalHistory(userId, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;
    const filter = this.buildUserWithdrawalHistoryFilter(userId, options);

    const documents = await this.model
      .find(filter)
      .select(PAYOUT_HISTORY_PROJECTION)
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

module.exports = PayoutRepository;
