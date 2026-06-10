/**
 * Timezone Helper
 * =================
 * Centralized, SAFE timezone handling for the application.
 *
 * BUSINESS RULE:
 *  - All business logic (sessions, betting windows, tasks) runs in IST
 *  - Server timezone is irrelevant (can be IST, UTC, Oregon, anywhere)
 *
 * This file guarantees:
 *  - Correct behavior at midnight (00:00–01:00 IST)
 *  - No double-offset bugs
 *  - Consistent results across environments
 */

const { DateTime } = require('luxon');

/**
 * Single source of truth for business timezone
 * NEVER infer this from server settings
 */
const BUSINESS_TIMEZONE = 'Asia/Kolkata';

/**
 * Get current time in IST (business time)
 *
 * @returns {DateTime} Luxon DateTime in IST
 */
const nowIST = () => {
  return DateTime.now().setZone(BUSINESS_TIMEZONE);
};

/**
 * Get current time in IST as native JS Date
 * (useful for MongoDB storage/comparisons)
 *
 * @returns {Date}
 */
const getCurrentISTTime = () => {
  return nowIST().toJSDate();
};

/**
 * Get start of current IST day (00:00 IST)
 *
 * IMPORTANT:
 *  - At 00:20 IST on Jan 22 → this returns Jan 22 00:00 IST
 *  - This is the ONLY correct sessionDate anchor
 *
 * @returns {Date}
 */
const getStartOfDayIST = () => {
  return nowIST().startOf('day').toJSDate();
};

/**
 * Get end of current IST day (23:59:59.999 IST)
 *
 * @returns {Date}
 */
const getEndOfDayIST = () => {
  return nowIST().endOf('day').toJSDate();
};

/**
 * Alias for session day anchor
 *
 * SessionDate definition:
 *  - Represents the BUSINESS DAY in IST
 *  - Always equals 00:00 IST of that day
 *
 * @returns {Date}
 */
const getSessionDateIST = () => {
  return getStartOfDayIST();
};

const getSessionDateForDateIST = (date = new Date()) => {
  return DateTime.fromJSDate(date, { zone: BUSINESS_TIMEZONE }).startOf('day').toJSDate();
};

const getWeekdayKeyIST = (date = new Date()) => {
  return DateTime
    .fromJSDate(date, { zone: BUSINESS_TIMEZONE })
    .toFormat('ccc')
    .toLowerCase();
};

/**
 * Build a Date on the session day using market schedule time
 *
 * Example:
 *  sessionDate = 22 Jan 00:00 IST
 *  timeStr     = "22:10"
 *  result      = 22 Jan 22:10 IST
 *
 * @param {Date} sessionDate - JS Date representing 00:00 IST
 * @param {string} timeStr - "HH:mm"
 * @returns {Date}
 */
const buildTimeOnSessionDate = (sessionDate, timeStr) => {
  if (!sessionDate || !timeStr) {
    return null;
  }

  const [hour, minute] = timeStr.split(':').map(Number);

  return DateTime
    .fromJSDate(sessionDate, { zone: BUSINESS_TIMEZONE })
    .set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    })
    .toJSDate();
};

/**
 * Check if current IST time is AFTER the given date
 *
 * @param {Date} date - Stored date (MongoDB / JS Date)
 * @returns {boolean}
 */
const isAfterIST = (date) => {
  if (!date) {
    return false;
  }
  return nowIST() > DateTime.fromJSDate(date, { zone: BUSINESS_TIMEZONE });
};

/**
 * Check if current IST time is BEFORE the given date
 *
 * @param {Date} date - Stored date (MongoDB / JS Date)
 * @returns {boolean}
 */
const isBeforeIST = (date) => {
  if (!date) {
    return false;
  }
  return nowIST() < DateTime.fromJSDate(date, { zone: BUSINESS_TIMEZONE });
};

/**
 * Format a date for display in IST (full date & time)
 *
 * @param {Date} date
 * @returns {string}
 */
const formatISTDate = (date) => {
  if (!date) {
    return null;
  }

  return DateTime
    .fromJSDate(date, { zone: BUSINESS_TIMEZONE })
    .toFormat('dd-MM-yyyy HH:mm:ss');
};

/**
 * Format only time in IST (HH:mm:ss)
 *
 * @param {Date} date
 * @returns {string}
 */
const formatISTTime = (date) => {
  if (!date) {
    return null;
  }

  return DateTime
    .fromJSDate(date, { zone: BUSINESS_TIMEZONE })
    .toFormat('HH:mm:ss');
};

module.exports = {
  BUSINESS_TIMEZONE,
  nowIST,
  getCurrentISTTime,
  getStartOfDayIST,
  getEndOfDayIST,
  getSessionDateIST,
  getSessionDateForDateIST,
  getWeekdayKeyIST,
  buildTimeOnSessionDate,
  isAfterIST,
  isBeforeIST,
  formatISTDate,
  formatISTTime,
};
