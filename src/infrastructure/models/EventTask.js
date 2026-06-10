const eventTaskTypes = require('@config/constants/eventTaskTypes');
const { EVENT_TASK_STATUS } = require('@config/constants/domain');
const mongoose = require('mongoose');

const eventTaskSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: eventTaskTypes, index: true },
  status: {
    type: String,
    enum: Object.values(EVENT_TASK_STATUS),
    default: EVENT_TASK_STATUS.PENDING,
    index: true,
  },
  priority: { type: Number, default: 2, index: true }, // 3: High, 2: Med, 1: Low
  scheduledAt: { type: Date, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 }, // Your requirement
  processedAt: Date,
}, { timestamps: true });

eventTaskSchema.index({ status: 1, priority: -1, scheduledAt: 1 });
module.exports = mongoose.model('EventTask', eventTaskSchema);
