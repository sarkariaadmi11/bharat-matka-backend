const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema(
  {
    level: { type: String, required: true, index: true },
    message: { type: String, required: true },
    event: { type: String, index: true },
    category: { type: String, index: true },
    requestId: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    route: { type: String, index: true },
    method: { type: String, index: true },
    ip: { type: String, index: true },
    statusCode: { type: Number, index: true },
    durationMs: { type: Number },
    fingerprint: { type: String, index: true },
    tags: [{ type: String }],
    request: { type: Object },
    error: { type: Object },
    meta: { type: Object },
  },
  { timestamps: true },
);

// Auto-delete logs after 30 days
LogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('Log', LogSchema);
