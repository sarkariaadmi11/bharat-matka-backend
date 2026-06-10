const BaseRepository = require('./baseRepository');
const { SettlementJob } = require('@infra/models');
const { SETTLEMENT_STATUS } = require('@config/constants/domain');

class SettlementJobRepository extends BaseRepository {
  constructor() {
    super(SettlementJob);
  }

  async markProcessing(jobId, session = null) {
    return this.model.findByIdAndUpdate(
      jobId,
      {
        $set: {
          status: SETTLEMENT_STATUS.PROCESSING,
          startedAt: new Date(),
          lastHeartbeatAt: new Date(),
          failedAt: null,
          failureReason: null,
        },
        $inc: {
          attemptCount: 1,
        },
      },
      {
        new: true,
        session,
      },
    );
  }

  async markCompleted(jobId, session = null) {
    return this.model.findByIdAndUpdate(
      jobId,
      {
        $set: {
          status: SETTLEMENT_STATUS.COMPLETED,
          completedAt: new Date(),
          lastHeartbeatAt: new Date(),
          failedAt: null,
          failureReason: null,
        },
      },
      {
        new: true,
        session,
      },
    );
  }

  async markFailed(jobId, reason, session = null) {
    return this.model.findByIdAndUpdate(
      jobId,
      {
        $set: {
          status: SETTLEMENT_STATUS.FAILED,
          failedAt: new Date(),
          lastHeartbeatAt: new Date(),
          failureReason: reason || 'Settlement execution failed',
        },
      },
      {
        new: true,
        session,
      },
    );
  }
}

module.exports = SettlementJobRepository;
