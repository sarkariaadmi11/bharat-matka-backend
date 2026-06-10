const express = require('express');
const { requireAdminAuth } = require('@middleware/auth');
const { userLimiter } = require('@middleware/rateLimiter');
const {
  listUsers,
  getUserDetails,
  blockUser,
  unblockUser,
  getUserStats,
  getUserBets,
  getUserTransactions,
  deleteUserTransaction,
  getUserWithdrawals,
  updateUserBet,
  deleteUserBet,
  createWalletAdjustment,
  resetUserPassword,
} = require('./adminUser.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin Users
 *     description: Admin user management APIs
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List users
 *     description: List users with pagination, search and status filters for admin panel.
 *     tags: [Admin, Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, blocked]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, lastLoginAt, username]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Users list fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AdminUsersListData'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get('/', ...requireAdminAuth, userLimiter, listUsers);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Get user details
 *     description: Fetch profile, wallet/exposure, status and account metadata for one user.
 *     tags: [Admin, Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AdminUserDetailsData'
 *       404:
 *         description: User not found
 */
router.get('/:id', ...requireAdminAuth, userLimiter, getUserDetails);

router.get('/:id/bets', ...requireAdminAuth, userLimiter, getUserBets);

router.get('/:id/transactions', ...requireAdminAuth, userLimiter, getUserTransactions);

router.delete('/:id/transactions/:transactionId', ...requireAdminAuth, userLimiter, deleteUserTransaction);

router.get('/:id/withdrawals', ...requireAdminAuth, userLimiter, getUserWithdrawals);

/**
 * @swagger
 * /admin/users/{id}/block:
 *   patch:
 *     summary: Block user
 *     description: Set user status to blocked and revoke active refresh token hash.
 *     tags: [Admin, Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User blocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AdminUserStatusActionData'
 *       404:
 *         description: User not found
 */
router.patch('/:id/block', ...requireAdminAuth, userLimiter, blockUser);

/**
 * @swagger
 * /admin/users/{id}/unblock:
 *   patch:
 *     summary: Unblock user
 *     description: Restore user status to active.
 *     tags: [Admin, Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AdminUserStatusActionData'
 *       404:
 *         description: User not found
 */
router.patch('/:id/unblock', ...requireAdminAuth, userLimiter, unblockUser);

/**
 * @swagger
 * /admin/users/{id}/stats:
 *   get:
 *     summary: Get user betting stats
 *     description: Aggregated betting stats for admin analytics.
 *     tags: [Admin, Admin Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stats fetched
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccess'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AdminUserStatsData'
 *       404:
 *         description: User not found
 */
router.get('/:id/stats', ...requireAdminAuth, userLimiter, getUserStats);

router.post('/:id/wallet-adjustments', ...requireAdminAuth, userLimiter, createWalletAdjustment);

router.patch('/:id/reset-password', ...requireAdminAuth, userLimiter, resetUserPassword);

router.patch('/:id/bets/:betId', ...requireAdminAuth, userLimiter, updateUserBet);

router.delete('/:id/bets/:betId', ...requireAdminAuth, userLimiter, deleteUserBet);

module.exports = router;
