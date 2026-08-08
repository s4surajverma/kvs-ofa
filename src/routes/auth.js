const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Helper: Password strength validation
function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  return null;
}

// 1. REGISTER USER
router.post('/register', async (req, res) => {
  try {
    const { fullName, designation, kvName, username, email, mobile, password, confirmPassword } = req.body;

    // Basic presence checks
    if (!fullName || !designation || !kvName || !username || !email || !mobile || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All registration fields are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password and Confirm Password do not match.' });
    }

    // Username format check
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return res.status(400).json({ success: false, message: 'Username must be 3-30 characters long and contain only letters, numbers, and underscores.' });
    }

    // Email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // Password strength check
    const pwdErr = validatePassword(password);
    if (pwdErr) {
      return res.status(400).json({ success: false, message: pwdErr });
    }

    const db = await getDb();

    // Check if username exists
    const existingUserByUsername = await db.findUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ success: false, message: 'Username is already taken. Please choose another.' });
    }

    // Check if email exists
    const existingUserByEmail = await db.findUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ success: false, message: 'Email address is already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save user with PENDING status
    const newUser = await db.createUser({
      fullName,
      designation: designation || '',
      kvName: kvName || '',
      username,
      email,
      mobile,
      passwordHash,
      role: 'USER',
      status: 'PENDING',
      approved: 0
    });

    return res.status(201).json({
      success: true,
      message: 'Registration submitted successfully. Your account is awaiting approval from the System Administrator.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        status: newUser.status
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during registration.' });
  }
});

// 2. LOGIN USER
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and Password are required.' });
    }

    const db = await getDb();
    const user = await db.findUserByUsernameOrEmail(identifier);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username/email or password.' });
    }

    // Status check
    if (user.status === 'PENDING' || !user.approved) {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has not yet been approved by the administrator.',
        status: user.status 
      });
    }

    if (user.status === 'REJECTED') {
      return res.status(403).json({ 
        success: false, 
        message: 'Your registration request was rejected by the administrator.',
        status: user.status 
      });
    }

    if (user.status === 'DISABLED') {
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been disabled by the administrator. Contact support for re-activation.',
        status: user.status 
      });
    }

    // Generate JWT
    const secret = process.env.JWT_SECRET || 'dev-secret-kvs';
    const payload = {
      id: user.id,
      fullName: user.fullName,
      kvName: user.kvName || '',
      username: user.username,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, secret, { expiresIn: '24h' });

    // Set Cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: payload
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
});

// 3. LOGOUT USER
router.post('/logout', (req, res) => {
  res.clearCookie('auth_token');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// 4. GET CURRENT USER (ME) — fetch full profile from DB for kvName etc.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.findUserById(req.user.id);
    if (!user) {
      return res.json({ success: true, user: req.user });
    }
    return res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        kvName: user.kvName || '',
        designation: user.designation || '',
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        approved: user.approved
      }
    });
  } catch (error) {
    // Fallback to JWT-embedded data
    return res.json({ success: true, user: req.user });
  }
});

// 5. CHANGE PASSWORD
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Current password, new password, and confirm password are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and Confirm Password do not match.' });
    }

    const pwdErr = validatePassword(newPassword);
    if (pwdErr) {
      return res.status(400).json({ success: false, message: pwdErr });
    }

    const db = await getDb();
    const user = await db.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await db.updateUserPassword(user.id, newPasswordHash);

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change Password Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while changing password.' });
  }
});

// 6. DELETE OWN ACCOUNT (Self-Service with Password Confirmation)
router.delete('/account', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password confirmation is required to delete your account.' });
    }

    const db = await getDb();
    const user = await db.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    // Prevent SUPERADMIN self-deletion via this route
    if (user.role === 'SUPERADMIN') {
      return res.status(403).json({ success: false, message: 'Super Admin accounts cannot be deleted through this interface.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Account deletion cancelled.' });
    }

    // Delete the user
    const deleted = await db.deleteUser(user.id);
    if (!deleted) {
      return res.status(500).json({ success: false, message: 'Failed to delete account. Please try again.' });
    }

    // Clear auth cookie
    res.clearCookie('auth_token');

    console.log(`[Account Deleted] User '${user.username}' (ID: ${user.id}) deleted their own account.`);

    return res.json({
      success: true,
      message: 'Your account has been permanently deleted. All associated data has been removed.'
    });

  } catch (error) {
    console.error('Account Deletion Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during account deletion.' });
  }
});

module.exports = router;
