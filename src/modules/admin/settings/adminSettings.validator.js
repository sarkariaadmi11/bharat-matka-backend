const { ValidationError } = require('@utils/errors');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const AMOUNT_FIELDS = [
  'minimumDeposit',
  'maximumDeposit',
  'minimumWithdrawal',
  'maximumWithdrawal',
  'minimumBidAmount',
  'maximumBidAmount',
  'welcomeBonus',
];

const validateSupportContactPayload = (data = {}) => {
  const errors = {};

  if (data.whatsappNumber !== undefined && data.whatsappNumber !== null) {
    const whatsapp = String(data.whatsappNumber).trim();
    if (whatsapp && !/^\d{10}$/.test(whatsapp)) {
      errors.whatsappNumber = 'WhatsApp number must be exactly 10 digits';
    }
  }

  if (data.telegramLink !== undefined && data.telegramLink !== null) {
    const telegram = String(data.telegramLink).trim();
    if (telegram && !telegram.startsWith('@')) {
      errors.telegramLink = 'Telegram link must start with @';
    }
  }

  if (data.supportEmail !== undefined && data.supportEmail !== null) {
    const supportEmail = String(data.supportEmail).trim().toLowerCase();
    if (supportEmail && !EMAIL_PATTERN.test(supportEmail)) {
      errors.supportEmail = 'Support email must be a valid email address';
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Invalid support contact settings', { details: errors });
  }

  return {
    whatsappNumber: data.whatsappNumber !== undefined ? String(data.whatsappNumber).trim() || null : undefined,
    telegramLink: data.telegramLink !== undefined ? String(data.telegramLink).trim() || null : undefined,
    supportEmail: data.supportEmail !== undefined ? String(data.supportEmail).trim().toLowerCase() || null : undefined,
  };
};

const validateSettingsPayload = (data = {}) => {
  const errors = {};

  if (Object.keys(data).length === 0) {
    throw new ValidationError('At least one field must be provided');
  }

  for (const field of AMOUNT_FIELDS) {
    if (data[field] !== undefined) {
      const value = Number(data[field]);
      if (!Number.isFinite(value) || value < 0) {
        errors[field] = `${field} must be a number >= 0`;
      }
    }
  }

  if (data.minimumDeposit !== undefined && data.maximumDeposit !== undefined) {
    if (Number(data.minimumDeposit) > Number(data.maximumDeposit)) {
      errors.minimumDeposit = 'minimumDeposit must be <= maximumDeposit';
    }
  }

  if (data.minimumWithdrawal !== undefined && data.maximumWithdrawal !== undefined) {
    if (Number(data.minimumWithdrawal) > Number(data.maximumWithdrawal)) {
      errors.minimumWithdrawal = 'minimumWithdrawal must be <= maximumWithdrawal';
    }
  }

  if (data.minimumBidAmount !== undefined && data.maximumBidAmount !== undefined) {
    if (Number(data.minimumBidAmount) > Number(data.maximumBidAmount)) {
      errors.minimumBidAmount = 'minimumBidAmount must be <= maximumBidAmount';
    }
  }

  if (data.withdrawOpenTime !== undefined) {
    if (typeof data.withdrawOpenTime !== 'string' || !TIME_PATTERN.test(data.withdrawOpenTime)) {
      errors.withdrawOpenTime = 'withdrawOpenTime must be in HH:mm 24-hour format';
    }
  }

  if (data.withdrawCloseTime !== undefined) {
    if (typeof data.withdrawCloseTime !== 'string' || !TIME_PATTERN.test(data.withdrawCloseTime)) {
      errors.withdrawCloseTime = 'withdrawCloseTime must be in HH:mm 24-hour format';
    }
  }

  if (data.globalBetting !== undefined) {
    if (typeof data.globalBetting !== 'boolean') {
      errors.globalBetting = 'globalBetting must be a boolean';
    }
  }

  if (data.resultDeclarationGraceHours !== undefined) {
    const value = Number(data.resultDeclarationGraceHours);
    if (!Number.isInteger(value) || value < 0 || value > 23) {
      errors.resultDeclarationGraceHours = 'resultDeclarationGraceHours must be an integer between 0 and 23';
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Invalid settings', { details: errors });
  }

  const payload = {};
  for (const field of [...AMOUNT_FIELDS, 'resultDeclarationGraceHours']) {
    if (data[field] !== undefined) {
      payload[field] = Number(data[field]);
    }
  }
  if (data.withdrawOpenTime !== undefined) {
    payload.withdrawOpenTime = data.withdrawOpenTime;
  }
  if (data.withdrawCloseTime !== undefined) {
    payload.withdrawCloseTime = data.withdrawCloseTime;
  }
  if (data.globalBetting !== undefined) {
    payload.globalBetting = data.globalBetting;
  }

  return payload;
};

module.exports = {
  validateSupportContactPayload,
  validateSettingsPayload,
};
