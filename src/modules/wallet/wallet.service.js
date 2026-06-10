const { RepositoryFactory } = require('@infra/database');
const { toPaise, toRupees } = require('@utils');
const { ValidationError, NotFoundError } = require('@utils/errors');

const walletRepository = RepositoryFactory.getRepository('Wallet');
const transactionRepository = RepositoryFactory.getRepository('Transaction');

const serializeTransaction = (transaction) => ({
  ...(transaction.toObject?.() || transaction),
  amount: toRupees(Math.abs(Number(transaction.amount || 0))),
  balanceAfter: toRupees(Number(transaction.balanceAfter || 0)),
  winAmount: transaction.winAmount === undefined ? transaction.winAmount : toRupees(Number(transaction.winAmount || 0)),
});

const getWallet = async (userId) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }
  const wallet = await walletRepository.findByUserId(userId);
  if (!wallet) {
    throw new NotFoundError('Wallet not found');
  }
  return {
    balance: toRupees(wallet.balance),
    exposure: toRupees(wallet.exposure),
    bonus: toRupees(wallet.bonus),
    currency: wallet.currency,
    updatedAt: wallet.updatedAt,
  };
};

const getTransactions = async (userId, page = 1, limit = 20) => {
  if (!userId) {
    throw new ValidationError('User is required');
  }
  const { documents, pagination } = await transactionRepository.findByFilter(
    { userId },
    page,
    limit,
  );
  return {
    documents: documents.map(serializeTransaction),
    pagination,
  };
};

const adminCredit = async ({ userId, amount }) => {
  if (!userId || typeof amount !== 'number' || amount <= 0) {
    throw new ValidationError('Invalid userId or amount');
  }

  const amountPaise = toPaise(amount);

  const wallet = await walletRepository.creditBalance(
    userId,
    amountPaise,
    'balance',
  );

  await transactionRepository.recordAdminAdjustment({
    userId,
    amount: amountPaise,
    balanceAfter: wallet.balance,
    referenceId: 'MANUAL_TEST_CREDIT',
    transactionContext: {
      source: 'admin',
      referenceType: 'ADMIN',
    },
  });

  return {
    balance: toRupees(wallet.balance),
  };
};

module.exports = {
  getWallet,
  getTransactions,
  adminCredit,
};

