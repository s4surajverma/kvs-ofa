const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All data routes require authentication
router.use(requireAuth);

// ── APPLICATIONS ──────────────────────────────────────────────

// GET /api/data/applications — Load all candidates for current user
router.get('/applications', async (req, res) => {
  try {
    const db = await getDb();
    const applications = await db.getApplications(req.user.id);
    return res.json({ success: true, data: applications });
  } catch (error) {
    console.error('Error loading applications:', error);
    return res.status(500).json({ success: false, message: 'Failed to load application data.' });
  }
});

// POST /api/data/applications/bulk — Replace all candidates for current user (full import)
router.post('/applications/bulk', async (req, res) => {
  try {
    const { candidates } = req.body;
    if (!Array.isArray(candidates)) {
      return res.status(400).json({ success: false, message: 'candidates must be an array.' });
    }
    const db = await getDb();
    await db.bulkReplaceApplications(req.user.id, candidates);
    return res.json({ success: true, message: `Saved ${candidates.length} application records.` });
  } catch (error) {
    console.error('Error saving applications:', error);
    return res.status(500).json({ success: false, message: 'Failed to save application data.' });
  }
});

// PATCH /api/data/applications/:regNo — Update a single candidate (verification status, audit)
router.patch('/applications/:regNo', async (req, res) => {
  try {
    const { regNo } = req.params;
    const updates = req.body;
    const db = await getDb();
    const updated = await db.updateApplication(req.user.id, regNo, updates);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    return res.json({ success: true, message: 'Application updated.' });
  } catch (error) {
    console.error('Error updating application:', error);
    return res.status(500).json({ success: false, message: 'Failed to update application.' });
  }
});

// DELETE /api/data/applications — Reset (delete all) applications for current user
router.delete('/applications', async (req, res) => {
  try {
    const db = await getDb();
    await db.deleteApplications(req.user.id);
    return res.json({ success: true, message: 'All application data has been reset.' });
  } catch (error) {
    console.error('Error resetting applications:', error);
    return res.status(500).json({ success: false, message: 'Failed to reset application data.' });
  }
});

// ── SCHOOL SETTINGS ───────────────────────────────────────────

// GET /api/data/settings — Load school settings for current user
router.get('/settings', async (req, res) => {
  try {
    const db = await getDb();
    const settings = await db.getSchoolSettings(req.user.id);
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error loading settings:', error);
    return res.status(500).json({ success: false, message: 'Failed to load school settings.' });
  }
});

// PUT /api/data/settings — Save school settings for current user
router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'settings object is required.' });
    }
    const db = await getDb();
    await db.saveSchoolSettings(req.user.id, settings);
    return res.json({ success: true, message: 'School settings saved.' });
  } catch (error) {
    console.error('Error saving settings:', error);
    return res.status(500).json({ success: false, message: 'Failed to save school settings.' });
  }
});

module.exports = router;
