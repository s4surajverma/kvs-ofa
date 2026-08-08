require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { getDb } = require('./src/db');
const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');

const app = express();
const PORT = process.env.PORT || 8080;

// Security & Parsing Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts and CDN references used by Bootstrap / Chart.js
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate Limiter for Auth Routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // Limit each IP to 100 requests per window
  message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);

const jwt = require('jsonwebtoken');

// Auth Check Middleware for Protected Application Pages
const checkPageAuth = (req, res, next) => {
  const token = req.cookies && req.cookies.auth_token;
  if (!token) {
    return res.redirect('/login.html');
  }
  const secret = process.env.JWT_SECRET || 'dev-secret-kvs';
  try {
    jwt.verify(token, secret);
    next();
  } catch (err) {
    return res.redirect('/login.html');
  }
};

// Public Unprotected Routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/superuser', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'superuser.html'));
});

app.get('/superuser.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'superuser.html'));
});

// Protected Application Routes (Requires auth_token cookie)
app.get('/', checkPageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/index.html', checkPageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', checkPageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve Static Assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route -> index.html if authenticated, login.html if not
app.get('*', (req, res) => {
  const token = req.cookies && req.cookies.auth_token;
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-kvs');
      return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } catch (e) {}
  }
  return res.redirect('/login.html');
});

// Initialize DB and start server
getDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log('====================================================');
      console.log(`  School Admission Management System Server`);
      console.log(`  Running at: http://localhost:${PORT}/`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Super Admin Portal: http://localhost:${PORT}/superuser`);
      console.log('====================================================');
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database and server:', err);
    process.exit(1);
  });
