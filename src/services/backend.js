/**
 * Service for communicating with the backend API
 */

const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:5000';

/**
 * Normalizes auth payload to match backend expectations
 */
const normalizeAuthPayload = (body) => ({
  Email: body.Email || body.email,
  Password: body.Password || body.password
});

/**
 * Generic helper to call backend services
 */
const callBackend = async (path, method, body, clientCookies = {}) => {
  try {
    const url = `${BACKEND_URL}/api/auth${path.startsWith('/') ? path : `/${path}`}`;
    
    // Convert cookie object to header string
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
    console.error(`Backend call failed: ${err.message}`);
    return {
      ok: false,
      status: 500,
      data: { error: 'Backend service unavailable' }
    };
  }
};

module.exports = {
  callBackend,
  normalizeAuthPayload,
  BACKEND_URL
};
