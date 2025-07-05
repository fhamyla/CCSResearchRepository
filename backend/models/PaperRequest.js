const mongoose = require('mongoose');

const paperRequestSchema = new mongoose.Schema({
  paperId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'papers.files'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  paperTitle: {
    type: String,
    required: true
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  processedDate: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminMessage: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaperRequest', paperRequestSchema);
