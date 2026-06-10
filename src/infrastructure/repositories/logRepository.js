const BaseRepository = require('./baseRepository');
const Log = require('@infra/models/Log');

class LogRepository extends BaseRepository {
  constructor() {
    super(Log);
  }

  async createLog(data) {
    return this.model.create(data);
  }

  async findPaged(filter = {}, page = 1, limit = 50, sort = { createdAt: -1 }) {
    const skip = (page - 1) * limit;
    const [documents, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.model.countDocuments(filter),
    ]);
    return {
      documents,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async deleteOlderThan(cutoffDate) {
    return this.model.deleteMany({ createdAt: { $lt: cutoffDate } });
  }
}

module.exports = LogRepository;

