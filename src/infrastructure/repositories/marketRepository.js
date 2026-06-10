// repositories/marketRepository.js
const BaseRepository = require('./baseRepository');
const { Market } = require('@infra/models');
const { MARKET_STATUS } = require('@config/constants/domain');

class MarketRepository extends BaseRepository {
  constructor() {
    super(Market);
  }

  /**
   * Get all active markets
   */
  async findActiveMarkets() {
    return this.model
      .find({ status: MARKET_STATUS.ACTIVE })
      .populate('gameTypes.gameTypeId', 'code name payoutMultiplier minBet maxBet status betPhaseType');
  }

  async findLeanById(id, projection = null) {
    let query = this.model.findById(id);
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  async findLeanByCode(code, projection = null) {
    let query = this.model.findOne({ code: String(code || '').toUpperCase() });
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  async findLeanByIds(ids = [], projection = null) {
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

  async findLeanByFilter(filter = {}, projection = null) {
    let query = this.model.find(filter);
    if (projection) {
      query = query.select(projection);
    }
    return query.lean();
  }

  async findActiveWithGameTypes() {
    return this.model
      .find({ status: MARKET_STATUS.ACTIVE })
      .populate('gameTypes.gameTypeId', 'code name payoutMultiplier rules betPhaseType minBet maxBet status')
      .select('name code openTime closeTime schedule gameTypes')
      .lean();
  }

  async findAllWithGameTypes(filter = {}) {
    return this.model
      .find(filter)
      .populate('gameTypes.gameTypeId', 'code name payoutMultiplier minBet maxBet status betPhaseType')
      .sort({ status: 1, code: 1 });
  }

  /**
   * Find market by code
   */
  async findByCode(code) {
    return await this.model.findOne({ code: code.toUpperCase() });
  }

  async findByCodes(codes = []) {
    const normalizedCodes = Array.isArray(codes)
      ? codes.filter(Boolean).map((code) => String(code).toUpperCase())
      : [];

    if (normalizedCodes.length === 0) {
      return [];
    }

    return this.model.find({ code: { $in: normalizedCodes } });
  }

  async findGameRateCatalog() {
    return this.model
      .find({ status: MARKET_STATUS.ACTIVE })
      .select('code name gameTypes')
      .lean();
  }

  async findByIdWithGameTypes(id) {
    return this.model
      .findById(id)
      .populate('gameTypes.gameTypeId', 'code name payoutMultiplier minBet maxBet status betPhaseType');
  }
}

module.exports = MarketRepository;

