const express = require('express');
const http = require('http');
const https = require('https');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

/**
 * Video Stream Proxy
 * Pipes the external video feed to the frontend to avoid CORS/Mixed content issues
 */
router.get('/video', requireAuth, (req, res) => {
  const target = process.env.CV_PERSONNEL_URL || 'https://cv.nathancollins.xyz/api/tracking/video_feed';
  const protocol = target.startsWith('https') ? https : http;
  
  const proxyReq = protocol.request(target, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (e) => {
    console.error('Video proxy error:', e);
    res.status(500).end();
  });
  
  proxyReq.end();
});

/**
 * Live Tracking Data Proxy
 */
router.get('/tracking-data', requireAuth, (req, res) => {
  const target = process.env.CV_PERSONNEL_DATA_URL || 'https://cv.nathancollins.xyz/api/tracking/live';
  const protocol = target.startsWith('https') ? https : http;
  
  const proxyReq = protocol.request(target, (proxyRes) => {
    let data = '';
    proxyRes.on('data', (chunk) => { data += chunk; });
    proxyRes.on('end', () => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      res.end(data);
    });
  });

  proxyReq.on('error', (e) => {
    console.error('Tracking data proxy error:', e);
    res.status(500).end();
  });

  proxyReq.end();
});

module.exports = router;
