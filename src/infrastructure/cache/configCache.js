const CONFIG_CACHE_TTL_MS = 30 * 1000;

let cachedConfig = null;
let cachedAt = 0;

const get = async (fetchFn) => {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < CONFIG_CACHE_TTL_MS) {
    return cachedConfig;
  }
  cachedConfig = await fetchFn();
  cachedAt = now;
  return cachedConfig;
};

const invalidate = () => {
  cachedConfig = null;
  cachedAt = 0;
};

module.exports = { get, invalidate };
