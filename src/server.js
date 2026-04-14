require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", 'blob:'],
      workerSrc: ["'self'", 'blob:'],
    }
  }
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files (public assets — excludes /unity which is gated below)
app.use(express.static(path.join(__dirname, '../public'), {
  index: false,
  dotfiles: 'deny',
}));

// API routes
app.use('/api/auth', authRoutes);

// Public page routes (no auth required)
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/verify-2fa', (_req, res) => res.sendFile(path.join(__dirname, '../public/verify-2fa.html')));

// Protected page routes (valid JWT required)
app.get('/setup-2fa', requireAuth, (_req, res) => res.sendFile(path.join(__dirname, '../public/setup-2fa.html')));
app.get('/dashboard', requireAuth, (_req, res) => res.sendFile(path.join(__dirname, '../public/dashboard.html')));

// Unity WebGL — entire /unity/* tree requires auth
app.use('/unity', requireAuth, express.static(path.join(__dirname, '../public/unity')));
app.get('/unity', requireAuth, (_req, res) => res.sendFile(path.join(__dirname, '../public/unity/index.html')));
app.get('/unity/*', requireAuth, (_req, res) => res.sendFile(path.join(__dirname, '../public/unity/index.html')));

// Connect to MongoDB then start server
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_manufacturing')
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    console.log('Starting server without MongoDB (auth will not work)...');
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  });
