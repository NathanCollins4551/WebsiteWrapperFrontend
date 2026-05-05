const jwt = require('jsonwebtoken');

/**
 * Middleware to ensure the user is logged in
 */
function requireAuth(req, res, next) {
  // Check cookie or authorization header
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Please login to continue' });
  }

  try {
    // Verify session token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
}

/**
 * Middleware to restrict access by role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to view this' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
