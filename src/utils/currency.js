const toPaise = (rupees) => {
  if (typeof rupees !== 'number') {
    throw new Error('Amount must be a number');
  }
  return Math.round(rupees * 100);
};

const toRupees = (paise) => {
  if (paise === null || paise === undefined) {
    return 0;
  }

  if (typeof paise !== 'number' || !Number.isFinite(paise)) {
    throw new TypeError('Invalid paise amount');
  }
  const safePaise = Math.round(paise);

  return safePaise / 100;
};

const formatRupees = (amount, { showDecimals = true } = {}) => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new TypeError('Invalid rupee amount');
  }
  if (!showDecimals && amount === 0) {
    return '0';
  }
  return amount.toFixed(2);
};

const formatINR = (paise) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(paise / 100);

module.exports = {
  toPaise,
  toRupees,
  formatINR,
  formatRupees,
};
