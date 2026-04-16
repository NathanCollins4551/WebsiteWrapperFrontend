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


/////
// Security middleware
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
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Global middleware to ensure COOP and COEP are always set, even if helmet is partially bypassed
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // Allow resources to be loaded by this page or from this page
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
app.use('/unity', (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, requireAuth, express.static(path.join(__dirname, '../public/unity'), {
  setHeaders: (res, filePath) => {
    // Explicitly set headers for every file served from /unity
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

// 2. API routes
app.use('/api/auth', authRoutes);

// 3. General static files (everything else in public)
app.use(express.static(path.join(__dirname, '../public'), {
  index: false,
  dotfiles: 'deny',
}));

// 4. Public HTML routes
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/register', (_req, res) => res.sendFile(path.join(__dirname, '../public/register.html')));
app.get('/verify-2fa', (_req, res) => res.sendFile(path.join(__dirname, '../public/verify-2fa.html')));

// 5. Protected HTML routes
app.get('/setup-2fa', requireAuth, (_req, res) => res.sendFile(path.join(__dirname, '../public/setup-2fa.html')));
app.get('/dashboard', requireAuth, (_req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));

// 6. SPA fallback for /unity/* (for deep linking)
app.get('/unity*', (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/unity/index.html'));
});

// 7. 404 handler
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, '../public/login.html')));

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ Frontend running on http://localhost:${PORT}`);
  console.log(`🔗 Backend: ${BACKEND_URL}`);
  console.log(`📡 CORS origin: ${corsOrigin}\n`);
});