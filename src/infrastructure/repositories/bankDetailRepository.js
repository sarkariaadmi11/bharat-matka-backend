const BaseRepository = require('./baseRepository');
const { BankDetail } = require('@infra/models');

class BankDetailRepository extends BaseRepository {
  constructor() {
    super(BankDetail);
  }

  async countBankAccountsByUserId(userId) {
    return this.model.countDocuments({
      userId,
      bankName: { $nin: [null, ''] },
      accountNumber: { $nin: [null, ''] },
      ifscCode: { $nin: [null, ''] },
    });
  }

  async findByUserId(userId) {
    return this.model.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
  }

  async findBankAccountsByUserId(userId) {
    return this.model.find({
      userId,
      bankName: { $nin: [null, ''] },
      accountNumber: { $nin: [null, ''] },
      ifscCode: { $nin: [null, ''] },
    }).sort({ isDefault: -1, createdAt: -1 });
  }

  async findPrimaryByUserId(userId, session = null) {
    return this.model.findOne({ userId }).sort({ isDefault: -1, createdAt: -1 }).session(session);
  }

  async findPreferredUpiByUserId(userId, session = null) {
    return this.model.findOne({
      userId,
      upiId: { $nin: [null, ''] },
    }).sort({ isDefault: -1, createdAt: -1 }).session(session);
  }

  async findByUserAndId(userId, bankDetailId, session = null) {
    return this.model.findOne({ _id: bankDetailId, userId }).session(session);
  }

  async deleteByUserAndId(userId, bankDetailId, session = null) {
    return this.model.findOneAndDelete({ _id: bankDetailId, userId }).session(session);
  }
}

module.exports = BankDetailRepository;
