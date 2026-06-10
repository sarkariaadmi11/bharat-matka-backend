/**
 * UserDevice Model
 * ----------------
 * Stores one FCM token per device so we can send push notifications.
 * This model is intentionally small and focused to keep it maintainable.
 *
 * Fields required by the spec:
 * - userId
 * - fcmToken
 * - deviceType
 * - appVersion
 * - isActive
 *
 * Optional fields can be added later (for example, market subscriptions).
 */

const mongoose = require('mongoose');

const userDeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fcmToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceType: {
      type: String,
      enum: ['android', 'ios', 'web', 'unknown'],
      default: 'unknown',
    },
    appVersion: {
      type: String,
      default: 'unknown',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Optional: allows targeting notifications by market in the future.
    // You can safely ignore this until you implement a subscription feature.
    marketSubscriptions: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

// Helpful indexes for common queries
userDeviceSchema.index({ userId: 1, isActive: 1 });
userDeviceSchema.index({ marketSubscriptions: 1, isActive: 1 });

module.exports = mongoose.model('UserDevice', userDeviceSchema);
