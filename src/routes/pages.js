const express = require('express');
const path = require('path');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Helper to serve HTML files
const servePage = (pageName) => (req, res) => {
  res.sendFile(path.join(__dirname, `../../public/${pageName}.html`));
};

// Public Routes
router.get(['/', '/login'], servePage('login'));
router.get('/register', servePage('register'));
router.get('/verify-2fa', servePage('verify-2fa'));

// Protected Routes
router.get('/setup-2fa', requireAuth, servePage('setup-2fa'));
router.get('/dashboard', requireAuth, servePage('dashboard'));

// Unity Routes (Protected)
router.get(['/unity', '/unity/index.html'], requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/unity/index.html'));
});

module.exports = router;
