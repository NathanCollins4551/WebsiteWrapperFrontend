const express = require('express');
const router = express.Router();
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/user');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({ error: 'Username or email already in use' });
    }

    const user = await User.create({ username, email, password, role: role || 'operator' });
    res.status(201).json({ message: 'Account created successfully', userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ $or: [{ username }, { email: username }] });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isLocked) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${remaining} minute(s).` });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      await user.incLoginAttempts();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset login attempts on success
    await user.updateOne({ $set: { loginAttempts: 0, lastLogin: new Date() }, $unset: { lockUntil: 1 } });

    if (user.twoFactorEnabled) {
      // Issue a short-lived pre-auth token for 2FA step
      const preAuthToken = jwt.sign(
        { userId: user._id, stage: 'pre-2fa' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({ requires2FA: true, preAuthToken });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ message: 'Login successful', token, user: { username: user.username, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/verify-2fa
router.post('/verify-2fa', async (req, res) => {
  try {
    const { token: code, preAuthToken } = req.body;
    if (!code || !preAuthToken) {
      return res.status(400).json({ error: 'Code and pre-auth token are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Pre-auth token expired. Please log in again.' });
    }

    if (decoded.stage !== 'pre-2fa') {
      return res.status(401).json({ error: 'Invalid token stage' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.twoFactorSecret) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    await user.updateOne({ $set: { lastLogin: new Date() } });

    const authToken = jwt.sign(
      { userId: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.cookie('token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ message: 'Login successful', token: authToken, user: { username: user.username, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/setup-2fa  (requires existing JWT)
router.post('/setup-2fa', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const secret = authenticator.generateSecret();
    await user.updateOne({ $set: { twoFactorTempSecret: secret } });

    const appName = process.env.TOTP_APP_NAME || 'SmartMfgPortal';
    const otpAuthUrl = authenticator.keyuri(user.email, appName, secret);
    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

    res.json({ secret, qrCode: qrDataUrl, otpAuthUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/confirm-2fa
router.post('/confirm-2fa', async (req, res) => {
  try {
    const { code } = req.body;
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || !user.twoFactorTempSecret) {
      return res.status(400).json({ error: 'No pending 2FA setup found' });
    }

    const isValid = authenticator.verify({ token: code, secret: user.twoFactorTempSecret });
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid code. Please try again.' });
    }

    await user.updateOne({
      $set: { twoFactorSecret: user.twoFactorTempSecret, twoFactorEnabled: true },
      $unset: { twoFactorTempSecret: 1 }
    });

    res.json({ message: '2FA enabled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/disable-2fa
router.post('/disable-2fa', async (req, res) => {
  try {
    const { code } = req.body;
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.twoFactorEnabled) {
      const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
      if (!isValid) return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    await user.updateOne({ $unset: { twoFactorSecret: 1, twoFactorTempSecret: 1 }, $set: { twoFactorEnabled: false } });
    res.json({ message: '2FA disabled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password -twoFactorSecret -twoFactorTempSecret');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
