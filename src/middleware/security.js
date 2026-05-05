/**
 * Security middleware to handle site-wide headers
 */

const securityHeaders = (req, res, next) => {
  // Required for SharedArrayBuffer and Unity WebGL
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
};

module.exports = { securityHeaders };
