require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// 1. ATOMIC HEADER ENFORCEMENT
// This middleware runs before everything and uses a wrap on writeHead 
// to ensure these headers are ATTACHED to every single response, 
// including 401s, 404s, and static files.
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Also hook into writeHead for late-binding headers
  const prevWriteHead = res.writeHead;
  res.writeHead = function() {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return prevWriteHead.apply(this, arguments);
  };
  next();
});

// 2. Standard Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", BACKEND_URL, 'https://newtwinbackend.quangphuly.online', 'wss://webstream.convai.com'],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", 'blob:'],
      workerSrc: ["'self'", 'blob:'],
    }
  },
  // We disable helmet's built-in versions because we enforce them 
  // atomically above to avoid conflicts or stripping.
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));

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

// 3. Unity Static Assets with Forced Headers
app.use('/unity', (req, res, next) => {
  // Redundant enforcement for the /unity path
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
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
