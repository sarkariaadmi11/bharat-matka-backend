const BaseRepository = require('./baseRepository');
const { GameType } = require('@infra/models');
const { MARKET_STATUS } = require('@config/constants/domain');

class GameTypeRepository extends BaseRepository {
  constructor() {
    super(GameType);
  }

  findLeanById(id, projection = null) {
    let query = this.model.findById(id);
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  findLeanByCode(code, projection = null) {
    let query = this.model.findOne({ code: String(code || '').toUpperCase() });
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  findLeanByIds(ids = [], projection = null) {
    const normalizedIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (normalizedIds.length === 0) {
      return [];
    }

    let query = this.model.find({ _id: { $in: normalizedIds } });
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  findLeanByFilter(filter = {}, projection = null) {
    let query = this.model.find(filter);
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  findActiveLean() {
    return this.model.find({ status: MARKET_STATUS.ACTIVE }).lean();
  }

  findByCode(code) {
    return this.model.findOne({ code: String(code || '').toUpperCase() });
  }

  findByCodes(codes = []) {
    const normalizedCodes = Array.isArray(codes)
      ? codes.filter(Boolean).map((code) => String(code).toUpperCase())
      : [];

    if (normalizedCodes.length === 0) {
      return [];
    }

    return this.model.find({ code: { $in: normalizedCodes } });
  }

  updateById(id, payload, options = {}) {
    return this.model.findByIdAndUpdate(
      id,
      payload,
      {
        new: true,
        runValidators: true,
        ...options,
      },
    );
  }

  findForAdminList(filter = {}) {
    return this.model.find(filter).sort({ status: 1, code: 1 }).lean();
  }

  findByIdOrCode(identifier) {
    const value = String(identifier || '').trim();
    if (!value) {
      return null;
    }

    if (value.match(/^[0-9a-fA-F]{24}$/)) {
      return this.model.findById(value);
    }

    return this.model.findOne({ code: value.toUpperCase() });
  }
}

module.exports = GameTypeRepository;

