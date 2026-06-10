const mongoose = require('mongoose');

const taskErrorSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventTask', required: true },
  taskType: String,
  errorMessage: String,
  stackTrace: String,
  attemptNumber: Number,
}, { timestamps: true });

module.exports = mongoose.model('ErrorTask', taskErrorSchema);
