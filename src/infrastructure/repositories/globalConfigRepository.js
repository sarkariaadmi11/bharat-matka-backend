const BaseRepository = require('./baseRepository');
const { GlobalConfig } = require('@infra/models');
const configCache = require('@infra/cache/configCache');

class GlobalConfigRepository extends BaseRepository {
  constructor() {
    super(GlobalConfig);
  }

  async getActiveConfig() {
    const config = await this.model.findOne().sort({ createdAt: -1 });
    if (!config) {
      throw new Error('GlobalConfig not found');
    }
    return config;
  }

  async lockSystem(reason = 'Manual lock') {
    const config = await this.getActiveConfig();
    config.systemLocked = true;
    config.lockReason = reason;
    configCache.invalidate();
    return await config.save();
  }

  async getOrCreateActiveConfig() {
    return configCache.get(async () => {
      const existingConfig = await this.model.findOne().sort({ createdAt: -1 });
      if (existingConfig) {
        return existingConfig;
      }
      return this.model.create({});
    });
  }

  async invalidateCache() {
    configCache.invalidate();
  }
}

module.exports = GlobalConfigRepository;

