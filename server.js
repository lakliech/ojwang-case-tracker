const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const path = require('path');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(cookieParser());

// Mongo Models
const Event = mongoose.model('Event', new mongoose.Schema({
  datetime: Date,
  description: String,
  highlight: Boolean,
  approved: { type: Boolean, default: false }
}));

const Conflict = mongoose.model('Conflict', new mongoose.Schema({
  datetime: Date,
  description: String,
  approved: { type: Boolean, default: false }
}));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true, useUnifiedTopology: true
});

// Auth Middleware
function isAuthenticated(req, res, next) {
  if (req.cookies.token === process.env.ADMIN_TOKEN) return next();
  res.redirect('/login');
}

// Login route
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/login.html'));
});

app.post('/login', (req, res) => {
  let data = '';
  req.on('data', chunk => (data += chunk));
  req.on('end', () => {
    const { username, password } = JSON.parse(data);
    if (
      username === process.env.ADMIN_USER &&
      password === process.env.ADMIN_PASS
    ) {
      res.cookie('token', process.env.ADMIN_TOKEN, { httpOnly: true });
      res.status(200).send('Login successful');
    } else {
      res.status(401).send('Unauthorized');
    }
  });
});

// Admin dashboard
app.get('/admin', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

// Get unapproved items
app.get('/admin/data', isAuthenticated, async (req, res) => {
  const events = await Event.find({ approved: false });
  const conflicts = await Conflict.find({ approved: false });
  res.json({ events, conflicts });
});

// Approve event/conflict
app.post('/admin/approve', isAuthenticated, async (req, res) => {
  const { type, id } = req.body;
  const Model = type === 'event' ? Event : Conflict;
  await Model.findByIdAndUpdate(id, { approved: true });
  res.status(200).send('Approved');
});

// Delete
app.post('/admin/delete', isAuthenticated, async (req, res) => {
  const { type, id } = req.body;
  const Model = type === 'event' ? Event : Conflict;
  await Model.findByIdAndDelete(id);
  res.status(200).send('Deleted');
});

// Public data
app.get('/data', async (req, res) => {
  const timeline = await Event.find({ approved: true }).sort('datetime');
  const conflicts = await Conflict.find({ approved: true }).sort('datetime');
  res.json({ timeline, conflicts });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
