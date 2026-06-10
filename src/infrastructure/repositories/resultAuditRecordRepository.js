const BaseRepository = require('./baseRepository');
const { ResultAuditRecord } = require('@infra/models');

class ResultAuditRecordRepository extends BaseRepository {
  constructor() {
    super(ResultAuditRecord);
  }

  async getAuditHistoryBySession(sessionId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.model
        .find({ sessionId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actor', 'username email')
        .lean(),
      this.model.countDocuments({ sessionId }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }
}

module.exports = ResultAuditRecordRepository;
