/**
 * Wallet Repository
 * Handles all financial movements with atomic precision.
 */

const BaseRepository = require('./baseRepository');
const { Wallet } = require('@infra/models');

const TransactionRepository = require('./transactionRepository');

class WalletRepository extends BaseRepository {
  constructor() {
    super(Wallet);
  }

  /**
   * Get transactions (ledger) for a user - pagination
   */
  async getTransactionsByUser(userId, page = 1, limit = 20) {
    const transaction = new TransactionRepository();
    return await transaction.getUserLedger(userId, page, limit);
  }

  /**
   * Find wallet by User ID
   */
  async findByUserId(userId, session = null) {
    return await this.model.findOne({ userId }).session(session);
  }

  async getExposureSummaryByUserId(userId) {
    return this.model
      .findOne({ userId })
      .select('balance exposure bonus currency updatedAt');
  }

  /**
   * Atomic Debit for Bet Placement
   * Moves money from 'balance' to 'exposure'
   * Ensures balance doesn't go below the required amount
   */
  async placeBetDebit(userId, amount, session = null) {
    const wallet = await this.model.findOneAndUpdate(
      {
        userId,
        balance: { $gte: amount }, // Safety: Check balance again at DB level
      },
      {
        $inc: {
          balance: -amount,
          exposure: amount,
        },
      },
      { new: true, session },
    );

    if (!wallet) {
      throw new Error('Insufficient balance or wallet not found');
    }
    return wallet;
  }

  /**
   * Atomic Settlement for Wins
   * Adds winnings to balance and clears exposure
   */
  async settleWin(userId, betAmount, winnings, session = null) {
    return await this.model.findOneAndUpdate(
      { userId },
      {
        $inc: {
          balance: winnings,
          exposure: -betAmount,
        },
      },
      { new: true, session },
    );
  }

  /**
   * Atomic Settlement for Losses
   * Simply clears the exposure (money was already deducted at bet placement)
   */
  async settleLoss(userId, betAmount, session = null) {
    return await this.model.findOneAndUpdate(
      { userId },
      {
        $inc: {
          exposure: -betAmount,
        },
      },
      { new: true, session },
    );
  }

  /**
   * Credit Wallet (Deposits / Admin Adjustments)
   */
  async creditBalance(userId, amount, type = 'balance', session = null) {
    const update = {};
    update[type] = amount;

    return await this.model.findOneAndUpdate(
      { userId },
      { $inc: update },
      { new: true, session },
    );
  }

  /**
   * Debit Wallet (Withdrawals)
   * Ensures balance doesn't go below required amount
   */
  async debitBalance(userId, amount, session = null) {
    const wallet = await this.model.findOneAndUpdate(
      {
        userId,
        balance: { $gte: amount },
      },
      {
        $inc: {
          balance: -amount,
        },
      },
      { new: true, session },
    );

    if (!wallet) {
      throw new Error('Insufficient balance or wallet not found');
    }
    return wallet;
  }

  async releaseBetExposure(userId, amount, session = null) {
    return await this.model.findOneAndUpdate(
      { userId },
      {
        $inc: {
          balance: amount,
          exposure: -amount,
        },
      },
      { new: true, session },
    );
  }

  async rebalanceForBetEdit(userId, delta, session = null) {
    if (!Number.isFinite(delta) || delta === 0) {
      return this.findByUserId(userId, session);
    }

    const filter = delta > 0
      ? { userId, balance: { $gte: delta } }
      : { userId };

    const wallet = await this.model.findOneAndUpdate(
      filter,
      {
        $inc: {
          balance: -delta,
          exposure: delta,
        },
      },
      { new: true, session },
    );

    if (!wallet) {
      throw new Error('Insufficient balance or wallet not found');
    }

    return wallet;
  }
}

module.exports = WalletRepository;

