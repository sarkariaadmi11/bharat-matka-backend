const LAST_IN_SEQUENCE = Number.MAX_SAFE_INTEGER;

const toSortableTime = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (!value) {
    return LAST_IN_SEQUENCE;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? LAST_IN_SEQUENCE : timestamp;
};

const defaultName = (item = {}) => item.name || item.marketName || '';
const defaultCloseTime = (item = {}) => item.closeTime;

/**
 * Markets are shown in the order their betting day closes.
 * Missing/invalid close times are pushed to the end, with market name as a stable tie-breaker.
 */
const compareBySessionCloseTime = (
  left,
  right,
  {
    getCloseTime = defaultCloseTime,
    getName = defaultName,
  } = {},
) => {
  const leftClose = toSortableTime(getCloseTime(left));
  const rightClose = toSortableTime(getCloseTime(right));

  if (leftClose !== rightClose) {
    return leftClose - rightClose;
  }

  return String(getName(left) || '').localeCompare(String(getName(right) || ''));
};

module.exports = {
  compareBySessionCloseTime,
  toSortableTime,
};
