// models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  date: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ['event', 'conflict'], default: 'event' },
  submittedBy: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);

