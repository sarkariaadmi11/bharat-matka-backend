const { ValidationError } = require('@utils/errors');

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
};

const buildPagination = (query = {}) => {
  const rawPage = toPositiveInt(query.page, 1);
  const rawLimit = toPositiveInt(query.limit, 20);

  const page = Math.max(rawPage, 1);
  const limit = Math.min(Math.max(rawLimit, 1), 100);

  if (!Number.isFinite(page) || !Number.isFinite(limit)) {
    throw new ValidationError('Invalid pagination query');
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

module.exports = {
  buildPagination,
};
