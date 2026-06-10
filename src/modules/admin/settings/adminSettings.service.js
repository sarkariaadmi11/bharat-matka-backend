const { RepositoryFactory } = require('@infra/database');
const { ValidationError } = require('@utils/errors');

const globalConfigRepository = RepositoryFactory.getRepository('GlobalConfig');

const DEFAULT_SETTINGS = {
  minimumDeposit: 100,
  maximumDeposit: 100000,
  minimumWithdrawal: 100,
  maximumWithdrawal: 100000,
  minimumBidAmount: 10,
  maximumBidAmount: 10000,
  welcomeBonus: 5,
  withdrawOpenTime: '09:00',
  withdrawCloseTime: '13:00',
  globalBetting: false,
  resultDeclarationGraceHours: 5,
};

const SETTINGS_FIELDS = [
  'minimumDeposit',
  'maximumDeposit',
  'minimumWithdrawal',
  'maximumWithdrawal',
  'minimumBidAmount',
  'maximumBidAmount',
  'welcomeBonus',
  'withdrawOpenTime',
  'withdrawCloseTime',
  'globalBetting',
  'resultDeclarationGraceHours',
];

const toSettingsResponse = (config) => {
  if (!config) {
    return { ...DEFAULT_SETTINGS };
  }
  const settings = {};
  for (const field of SETTINGS_FIELDS) {
    settings[field] = config[field] !== undefined ? config[field] : DEFAULT_SETTINGS[field];
  }
  return settings;
};

class AdminSettingsService {
  async getSupportContact() {
    const config = await globalConfigRepository.findOne();

    if (!config) {
      return {
        whatsappNumber: null,
        telegramLink: null,
        supportEmail: null,
      };
    }

    return {
      whatsappNumber: config.supportContact?.whatsappNumber || null,
      telegramLink: config.supportContact?.telegramLink || null,
      supportEmail: config.supportContact?.supportEmail || null,
    };
  }

  async updateSupportContact(payload) {
    if (
      !payload
      || (
        payload.whatsappNumber === undefined
        && payload.telegramLink === undefined
        && payload.supportEmail === undefined
      )
    ) {
      throw new ValidationError('At least one field must be provided');
    }

    let config = await globalConfigRepository.findOne();

    if (!config) {
      config = await globalConfigRepository.create({
        supportContact: {
          whatsappNumber: payload.whatsappNumber || null,
          telegramLink: payload.telegramLink || null,
          supportEmail: payload.supportEmail || null,
        },
      });
    } else {
      config.supportContact = config.supportContact || {};
      if (payload.whatsappNumber !== undefined) {
        config.supportContact.whatsappNumber = payload.whatsappNumber || null;
      }
      if (payload.telegramLink !== undefined) {
        config.supportContact.telegramLink = payload.telegramLink || null;
      }
      if (payload.supportEmail !== undefined) {
        config.supportContact.supportEmail = payload.supportEmail || null;
      }
      await config.save();
    }

    return {
      whatsappNumber: config.supportContact?.whatsappNumber || null,
      telegramLink: config.supportContact?.telegramLink || null,
      supportEmail: config.supportContact?.supportEmail || null,
      updatedAt: config.updatedAt,
    };
  }

  async getSettings() {
    const config = await globalConfigRepository.findOne();
    return toSettingsResponse(config);
  }

  _validateCrossFieldConstraints(config) {
    const errors = {};

    const pairs = [
      ['minimumDeposit', 'maximumDeposit'],
      ['minimumWithdrawal', 'maximumWithdrawal'],
      ['minimumBidAmount', 'maximumBidAmount'],
    ];

    for (const [minField, maxField] of pairs) {
      const minVal = config[minField];
      const maxVal = config[maxField];
      if (minVal !== undefined && maxVal !== undefined && Number(minVal) > Number(maxVal)) {
        errors[minField] = `${minField} (${minVal}) must be <= ${maxField} (${maxVal})`;
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Cross-field validation failed', { details: errors });
    }
  }

  async updateSettings(payload) {
    let config = await globalConfigRepository.findOne();
    let mergedConfig;

    if (!config) {
      mergedConfig = { ...DEFAULT_SETTINGS, ...payload };
    } else {
      mergedConfig = { ...(typeof config.toObject === 'function' ? config.toObject() : config), ...payload };
    }

    this._validateCrossFieldConstraints(mergedConfig);

    if (!config) {
      config = await globalConfigRepository.create(mergedConfig);
    } else {
      for (const [key, value] of Object.entries(payload)) {
        config[key] = value;
      }
      await config.save();
    }

    await globalConfigRepository.invalidateCache();

    return toSettingsResponse(config);
  }
}

module.exports = new AdminSettingsService();
