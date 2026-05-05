const express = require('express');
const path = require('path');
const { requireAuth } = require('./auth');

/**
 * Middleware for serving Unity WebGL files with proper headers
 */
const unityStatic = express.static(path.join(__dirname, '../../public/unity'), {
  setHeaders: (res, filePath) => {
    // Re-assert security headers for assets
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Handle Unity's Brotli compressed files
    if (filePath.toLowerCase().endsWith('.unityweb')) {
      res.setHeader('Content-Encoding', 'br');
      
      // Map specific unityweb extensions to correct types
      if (filePath.toLowerCase().endsWith('.wasm.unityweb')) {
        res.setHeader('Content-Type', 'application/wasm');
      } else if (filePath.toLowerCase().endsWith('.framework.js.unityweb')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.toLowerCase().endsWith('.data.unityweb')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
    }
  }
});

/**
 * Combined middleware for Unity assets including auth checks
 */
const handleUnityAssets = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  
  // If no token and trying to access the main unity page, redirect to login
  if (!token) {
    const isMainPage = req.path === '/' || req.path === '/index.html' || req.path === '';
    if (isMainPage) {
      return res.redirect('/login');
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Use standard auth check and then serve static files
  requireAuth(req, res, () => {
    unityStatic(req, res, next);
  });
};

module.exports = { handleUnityAssets };
