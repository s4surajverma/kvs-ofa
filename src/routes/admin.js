const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// 1. SUPER ADMIN LOGIN
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  const expectedUsername = process.env.SUPERADMIN_USERNAME || 'superadmin';
  const expectedPassword = process.env.SUPERADMIN_PASSWORD || 'admin123';

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Superadmin username and password required.' });
  }

  if (username !== expectedUsername || password !== expectedPassword) {
    return res.status(401).json({ success: false, message: 'Invalid Super Admin credentials.' });
  }

  const secret = process.env.JWT_SECRET || 'dev-secret-kvs';
  const payload = {
    id: 0,
    fullName: 'System Administrator',
    username: expectedUsername,
    email: 'admin@system.local',
    role: 'SUPERADMIN'
  };

  const token = jwt.sign(payload, secret, { expiresIn: '24h' });

  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  return res.json({
    success: true,
    message: 'Superadmin login successful.',
    token,
    user: payload
  });
});

// All subsequent routes require SUPERADMIN role
router.use(requireAuth, requireRole(['SUPERADMIN']));

// 2. GET ALL USERS (Categorized)
router.get('/users', async (req, res) => {
  try {
    const db = await getDb();
    const allUsers = await db.getAllUsers();

    const pending = allUsers.filter(u => u.status === 'PENDING');
    const approved = allUsers.filter(u => u.status === 'APPROVED');
    const rejected = allUsers.filter(u => u.status === 'REJECTED' || u.status === 'DISABLED');

    return res.json({
      success: true,
      data: {
        all: allUsers,
        pending,
        approved,
        rejected
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch user records.' });
  }
});

// 3. APPROVE USER
router.post('/users/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const updatedUser = await db.updateUserStatus(id, {
      status: 'APPROVED',
      approved: true,
      approvedBy: req.user.username
    });

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      message: `User '${updatedUser.username}' has been APPROVED. They can now log in.`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error approving user:', error);
    return res.status(500).json({ success: false, message: 'Failed to approve user.' });
  }
});

// 4. REJECT USER
router.post('/users/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const updatedUser = await db.updateUserStatus(id, {
      status: 'REJECTED',
      approved: false,
      approvedBy: req.user.username
    });

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      message: `User '${updatedUser.username}' has been REJECTED.`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error rejecting user:', error);
    return res.status(500).json({ success: false, message: 'Failed to reject user.' });
  }
});

// 5. DISABLE USER
router.post('/users/:id/disable', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const updatedUser = await db.updateUserStatus(id, {
      status: 'DISABLED',
      approved: false,
      approvedBy: req.user.username
    });

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      message: `User '${updatedUser.username}' has been DISABLED.`,
      user: updatedUser
    });
  } catch (error) {
    console.error('Error disabling user:', error);
    return res.status(500).json({ success: false, message: 'Failed to disable user.' });
  }
});

// 6. DELETE USER
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const deleted = await db.deleteUser(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      message: 'User account deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete user.' });
  }
});

module.exports = router;
