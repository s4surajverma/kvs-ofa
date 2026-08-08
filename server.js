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

// Explicit HTML Route Handles
app.get('/superuser', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'superuser.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve Static Assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route -> index.html or login.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
