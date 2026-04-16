const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');

// Backend config
const BACKEND_URL =
  process.env.BACKEND_URL?.replace(/\/$/, '') ||
  'http://localhost:5000';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'dev-key-minimum-32-characters-long-xxxxxxxxxxxxxxxxxxxxxxxx';

/**
 * Normalize payload to backend contract
 * Backend EXPECTS:
 * {
 *   Email: string,
 *   Password: string
 * }
 */
function normalizeAuthPayload(body) {
  return {
    Email: body.Email || body.email,
    Password: body.Password || body.password
  };
}

/**
 * Backend call helper
 */
async function callBackend(path, method, body, clientCookies = {}) {
  try {
    const url = `${BACKEND_URL}/api/auth${path.startsWith('/') ? path : `/${path}`}`;

    console.log('\n==============================');
    console.log('➡️ BACKEND_URL:', BACKEND_URL);
    console.log('➡️ REQUEST URL:', url);
    console.log('➡️ METHOD:', method);
    console.log('➡️ PAYLOAD:', body);
    console.log('==============================\n');

    // Build Cookie header to send to backend
    const cookieHeader = Object.entries(clientCookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': cookieHeader
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const text = await response.text();
    const setCookie = response.headers.get('set-cookie');

    console.log('⬅️ STATUS:', response.status);
    console.log('⬅️ RESPONSE:', text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      setCookie
    };

  } catch (err) {
    console.error('\n❌ BACKEND FETCH FAILED');
    console.error('URL:', `${BACKEND_URL}/Auth${path}`);
    console.error('ERROR:', err.message);

    return {
      ok: false,
      status: 500,
      data: {
        error: 'Backend service unavailable',
        detail: err.message
      }
    };
  }
}

/**
 * REGISTER
 */
router.post('/register', async (req, res) => {
  const payload = normalizeAuthPayload(req.body);

  const result = await callBackend('/signup', 'POST', payload, req.cookies);

  if (!result.ok) {
    console.error('❌ REGISTER FAILED:', result.data);
    return res.status(result.status).json(result.data);
  }

  res.json(result.data);
});

/**
 * LOGIN
 */
router.post('/login', async (req, res) => {
  const payload = normalizeAuthPayload(req.body);

  const result = await callBackend('/login', 'POST', payload, req.cookies);

  if (!result.ok) {
    console.error('❌ LOGIN FAILED:', result.data);
    return res.status(result.status).json(result.data);
  }

  // Forward backend cookies (like trusted_device) if they exist
  if (result.setCookie) {
    res.setHeader('Set-Cookie', result.setCookie);
  }

  // If successful and a token is returned (trusted device bypass), set the session token cookie
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
 * VERIFY 2FA
 */
router.post('/verify', async (req, res) => {
  const result = await callBackend('/verify-2fa', 'POST', req.body, req.cookies);

  if (!result.ok) {
    console.error('❌ VERIFY FAILED:', result.data);
    return res.status(result.status).json(result.data);
  }

  // Forward backend cookies (like trusted_device) if they exist
  if (result.setCookie) {
    res.setHeader('Set-Cookie', result.setCookie);
  }

  // If successful, set session token cookie for the frontend
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
 * GET CURRENT USER
 */
router.get('/me', requireAuth, (req, res) => {
  // req.user was set by requireAuth middleware
  // We need to map claims to what the frontend expects (username vs email)
  res.json({
    user: {
      id: req.user.sub,
      username: req.user.email || req.user.username || 'User',
      role: req.user.role || 'operator'
    }
  });
});

/**
 * LOGOUT
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

/**
 * HEALTH CHECK
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'frontend-auth',
    backend: BACKEND_URL,
    contract: {
      login: {
        email: 'required',
        password: 'required'
      }
    }
  });
});

module.exports = router;