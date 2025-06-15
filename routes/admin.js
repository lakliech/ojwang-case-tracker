// routes/admin.js
const express = require('express');
const router = express.Router();
const Report = require('../models/Report');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'password123';

// Login page
router.get('/login', (req, res) => {
  res.send(`
    <form method="POST" action="/admin/login">
      <h2>Admin Login</h2>
      <input name="username" placeholder="Username" />
      <input name="password" placeholder="Password" type="password" />
      <button type="submit">Login</button>
    </form>
  `);
});

// Login POST
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.admin = true;
    return res.redirect('/admin/dashboard');
  }
  res.send('Invalid login.');
});

// Middleware guard
function isAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.redirect('/admin/login');
}

// Admin Dashboard
router.get('/dashboard', isAdmin, async (req, res) => {
  const reports = await Report.find().sort({ date: 1 });
  res.send(`
    <h2>Admin Dashboard</h2>
    <a href="/admin/logout">Logout</a>
    <ul>
      ${reports.map(r => `<li><b>${r.date}</b>: ${r.description}</li>`).join('')}
    </ul>
  `);
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

module.exports = router;

