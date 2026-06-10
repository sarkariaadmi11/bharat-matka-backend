const BaseRepository = require('./baseRepository');
const { Role } = require('@infra/models');

class RoleRepository extends BaseRepository {
  constructor() {
    super(Role);
  }

  async findByCode(code, session = null) {
    return await this.model.findOne({ code }).session(session);
  }
}

module.exports = RoleRepository;

