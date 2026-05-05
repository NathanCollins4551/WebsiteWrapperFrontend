const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { callBackend, normalizeAuthPayload, BACKEND_URL } = require('../services/backend');

/**
 * User Registration
 */
router.post('/register', async (req, res) => {
  const payload = normalizeAuthPayload(req.body);
  const result = await callBackend('/signup', 'POST', payload, req.cookies);

  if (!result.ok) {
    return res.status(result.status).json(result.data);
  }

  res.json(result.data);
});

/**
 * User Login
 */
router.post('/login', async (req, res) => {
  const payload = normalizeAuthPayload(req.body);
  const result = await callBackend('/login', 'POST', payload, req.cookies);

  if (!result.ok) {
    return res.status(result.status).json(result.data);
  }

  // Forward backend cookies (like trusted_device)
  if (result.setCookie) {
    res.setHeader('Set-Cookie', result.setCookie);
  }

  // Set local session cookie if token returned
  if (result.data.token) {
    res.cookie('token', result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000 // 1 hour
    });
  }

  res.json(result.data);
});

/**
 * 2FA Verification
 */
router.post('/verify', async (req, res) => {
  const result = await callBackend('/verify-2fa', 'POST', req.body, req.cookies);

  if (!result.ok) {
    return res.status(result.status).json(result.data);
  }

  if (result.setCookie) {
    res.setHeader('Set-Cookie', result.setCookie);
  }

  if (result.data.token) {
    res.cookie('token', result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 3600000
    });
  }

  res.json(result.data);
});

/**
 * Current Session Info
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.sub,
      username: req.user.email || req.user.username || 'User',
      role: req.user.role || 'operator'
    }
  });
});

/**
 * Session Termination
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

/**
 * Service Status
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    backend: BACKEND_URL
  });
});

module.exports = router;
