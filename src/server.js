require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');

// Internal Modules
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');
const { securityHeaders } = require('./middleware/security');
const { handleUnityAssets } = require('./middleware/unity');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Security & Core Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now as Unity needs various external resources
  crossOriginEmbedderPolicy: { policy: "require-corp" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(securityHeaders);

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || ['http://localhost:3000', 'https://makerspace.nathancollins.xyz'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 2. Specialized Asset Serving
// Unity requires specific headers and auth check
app.use('/unity', handleUnityAssets);

// 3. Application Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/', pageRoutes);

// 4. General Static Files
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res) => {
    // Keep COOP/COEP for all static files
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
}));

// 5. Fallback Handler (404)
// Redirect unknown routes to login
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../public/login.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n✅ Frontend running on http://localhost:${PORT}`);
  console.log(`🔗 Backend: ${process.env.BACKEND_URL || 'http://localhost:5000'}\n`);
});
