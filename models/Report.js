const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  date: String,
  datetime: Date,           // for timeline
  event: String,            // for timeline
  issue: String,            // for contradiction
  description: String,
  source: String,
  category: {
    type: String,
    enum: ['timeline', 'conflict'],
    required: true
  },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);
