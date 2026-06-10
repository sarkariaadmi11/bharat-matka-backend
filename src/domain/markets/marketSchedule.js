const { DateTime } = require('luxon');
const { BUSINESS_TIMEZONE } = require('@utils/timezoneHelper');
const { ValidationError } = require('@utils/errors');

const WEEKDAY_KEYS = Object.freeze(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const normalizeWeekdayKey = (weekday) => String(weekday || '').trim().slice(0, 3).toLowerCase();

const toPlainScheduleObject = (schedule) => {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    return schedule;
  }

  if (typeof schedule.toObject === 'function') {
    return schedule.toObject();
  }

  if (schedule._doc && typeof schedule._doc === 'object' && !Array.isArray(schedule._doc)) {
    return schedule._doc;
  }

  return schedule;
};

const ensureScheduleObject = (schedule, label = 'schedule') => {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    throw new ValidationError(`${label} must be an object`);
  }
};

const validateKnownWeekdayKeys = (keys = [], label = 'schedule') => {
  const invalidKey = keys.find((key) => !WEEKDAY_KEYS.includes(normalizeWeekdayKey(key)));
  if (invalidKey) {
    throw new ValidationError(`${label}.${invalidKey} is not a valid weekday`);
  }
};

const validateMarketTiming = (openTime, closeTime) => {
  if (!TIME_PATTERN.test(String(openTime || '')) || !TIME_PATTERN.test(String(closeTime || ''))) {
    throw new ValidationError('openTime and closeTime must use HH:mm time format');
  }

  if (openTime >= closeTime) {
    throw new ValidationError('openTime must be earlier than closeTime');
  }

  return true;
};

const buildWeeklySchedule = (schedule = {}) => {
  const source = toPlainScheduleObject(schedule);
  ensureScheduleObject(source);
  const keys = Object.keys(source).filter(key => !key.startsWith('$'));
  validateKnownWeekdayKeys(keys);

  return WEEKDAY_KEYS.reduce((accumulator, weekday) => {
    const value = source[weekday];

    if (value === undefined) {
      accumulator[weekday] = false;
      return accumulator;
    }

    if (typeof value !== 'boolean') {
      throw new ValidationError(`schedule.${weekday} must be a boolean`);
    }

    accumulator[weekday] = value;
    return accumulator;
  }, {});
};

const applyScheduleUpdate = (existing = {}, patch = {}) => {
  const normalizedPatch = toPlainScheduleObject(patch);
  ensureScheduleObject(normalizedPatch, 'schedule patch');

  const providedKeys = Object.keys(normalizedPatch);
  if (providedKeys.length === 0) {
    throw new ValidationError('schedule patch must include at least one weekday');
  }

  validateKnownWeekdayKeys(providedKeys, 'schedule');
  const current = buildWeeklySchedule(existing);
  const next = { ...current };

  providedKeys.forEach((weekday) => {
    const normalizedWeekday = normalizeWeekdayKey(weekday);
    if (typeof normalizedPatch[weekday] !== 'boolean') {
      throw new ValidationError(`schedule.${normalizedWeekday} must be a boolean`);
    }
    next[normalizedWeekday] = normalizedPatch[weekday];
  });

  return next;
};

const isMarketActiveOnDay = (schedule = {}, date = new Date()) => {
  const normalizedSchedule = buildWeeklySchedule(schedule);
  const weekday = normalizeWeekdayKey(
    DateTime.fromJSDate(date, { zone: BUSINESS_TIMEZONE }).toFormat('ccc'),
  );

  return normalizedSchedule[weekday] === true;
};

module.exports = {
  WEEKDAY_KEYS,
  TIME_PATTERN,
  buildWeeklySchedule,
  applyScheduleUpdate,
  isMarketActiveOnDay,
  validateMarketTiming,
};
