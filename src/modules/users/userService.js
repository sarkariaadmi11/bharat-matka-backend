/**
 * User Service
 * Business logic layer - uses repository for database operations
 */

const { RepositoryFactory } = require('@infra/database');

const userRepository = RepositoryFactory.getRepository('User');

/**
 * Create a new user
 */
// const createUser = async (userData) => {
//   // Check if email already exists
//   const emailExists = await userRepository.emailExists(userData.email);
//   if (emailExists) {
//     throw new Error('Email already registered');
//   }
//   return await userRepository.create(userData);
// };

/**
 * Get all users with pagination
 */
const getAllUsers = async (page = 1, limit = 10) => {
  const result = await userRepository.findAll(page, limit);
  return {
    users: result.documents,
    pagination: result.pagination,
  };
};

/**
 * Get user by ID
 */
const getUserById = async (userId) => {
  return await userRepository.findById(userId);
};

/**
 * Update user
 */
const updateUser = async (userId, updateData) => {
  return await userRepository.update(userId, updateData);
};

/**
 * Delete user
 */
const deleteUser = async (userId) => {
  return await userRepository.delete(userId);
};

/**
 * Find user by email
 */
const findUserByEmail = async (email) => {
  return await userRepository.findByEmail(email);
};

/**
 * Get active users
 */
const getActiveUsers = async (page = 1, limit = 10) => {
  const result = await userRepository.findActiveUsers(page, limit);
  return {
    users: result.documents,
    pagination: result.pagination,
  };
};

/**
 * Change user status
 */
const changeUserStatus = async (userId, status) => {
  return await userRepository.changeStatus(userId, status);
};

/**
 * Search users by name or email
 */
// const searchUsers = async (query, page = 1, limit = 10) => {
//   const result = await userRepository.search(query, page, limit);
//   return {
//     users: result.documents,
//     pagination: result.pagination,
//   };
// };

module.exports = {
  // createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  findUserByEmail,
  getActiveUsers,
  changeUserStatus,
  // searchUsers,
};

