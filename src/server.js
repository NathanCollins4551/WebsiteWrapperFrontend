require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// GLOBAL HEADER ENFORCEMENT
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

const corsOrigin = process.env.ALLOWED_ORIGIN || [
  'http://localhost:3000',
  'https://makerspace.nathancollins.xyz'
];
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 1. Specific Unity WebGL routes (MUST BE BEFORE GENERAL STATIC)
// Specialized auth for unity assets to prevent "Unexpected token <" (HTML instead of JS)
app.use('/unity', (req, res, next) => {
  // Check auth but don't redirect for assets
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) {
    if (req.path === '/' || req.path === '/index.html' || req.path === '') {
      return res.status(401).sendFile(path.join(__dirname, '../public/login.html'));
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}, requireAuth, express.static(path.join(__dirname, '../public/unity'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    if (filePath.toLowerCase().endsWith('.unityweb')) {
      res.setHeader('Content-Encoding', 'br');
      if (filePath.toLowerCase().endsWith('.wasm.unityweb')) {
        res.setHeader('Content-Type', 'application/wasm');
      } else if (filePath.toLowerCase().endsWith('.framework.js.unityweb')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.toLowerCase().endsWith('.data.unityweb')) {
        res.setHeader('Content-Type', 'application/octet-stream');
      }
    }
  }
}));

app.use('/api/auth', authRoutes);

app.use(express.static(path.join(__dirname, '../public'), {
  index: false,
  dotfiles: 'deny',
}));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/register', (_req, res) => res.sendFile(path.join(__dirname, '../public/register.html')));
app.get('/verify-2fa', (_req, res) => res.sendFile(path.join(__dirname, '../public/verify-2fa.html')));

app.get('/setup-2fa', requireAuth, (_req, res) => res.sendFile(path.join(__dirname, '../public/setup-2fa.html')));
app.get('/dashboard', requireAuth, (_req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));

app.get('/unity*', (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/unity/index.html'));
});

app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, '../public/login.html')));

app.listen(PORT, () => {
  console.log(`\n✅ Frontend running on http://localhost:${PORT}`);
  console.log(`🔗 Backend: ${BACKEND_URL}`);
  console.log(`📡 CORS origin: ${corsOrigin}\n`);
});
