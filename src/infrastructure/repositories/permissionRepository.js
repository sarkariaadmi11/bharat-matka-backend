const BaseRepository = require('./baseRepository');
const { Permission } = require('@infra/models');

class PermissionRepository extends BaseRepository {
  constructor() {
    super(Permission);
  }

  async findByCode(code, session = null) {
    return this.model.findOne({ code }).session(session);
  }

  async findByCodes(codes = [], session = null) {
    return this.model.find({ code: { $in: codes } }).session(session);
  }
}

module.exports = PermissionRepository;
