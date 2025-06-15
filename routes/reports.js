// routes/reports.js
const express = require('express');
const router = express.Router();
const Report = require('../models/Report');

// GET all reports
router.get('/', async (req, res) => {
  try {
    const reports = await Report.find().sort({ date: 1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// POST new report
router.post('/', async (req, res) => {
  const { date, description, category, submittedBy } = req.body;

  try {
    const report = new Report({ date, description, category, submittedBy });
    await report.save();
    res.status(201).json({ message: 'Report submitted', report });
  } catch (err) {
    res.status(400).json({ error: 'Invalid report submission' });
  }
});

module.exports = router;

