let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  const { DatabaseSync } = require('node:sqlite');
  Database = class extends DatabaseSync {
    pragma(str) {
      return this.exec(`PRAGMA ${str}`);
    }
  };
}

const fs = require('fs');
const path = require('path');
const { SQLITE_SCHEMA } = require('./schema');

class SQLiteAdapter {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SQLITE_SCHEMA);
    try { this.db.exec("ALTER TABLE users ADD COLUMN designation TEXT DEFAULT ''"); } catch(e) {}
    try { this.db.exec("ALTER TABLE users ADD COLUMN kv_name TEXT DEFAULT ''"); } catch(e) {}
    console.log(`[SQLite Database] Initialized successfully at ${this.dbPath}`);
  }

  // ── USER METHODS ─────────────────────────────────────────────

  async createUser({ fullName, designation = '', kvName = '', username, email, mobile, passwordHash, role = 'USER', status = 'PENDING', approved = 0 }) {
    const stmt = this.db.prepare(`
      INSERT INTO users (full_name, designation, kv_name, username, email, mobile, password_hash, role, status, approved, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);
    const info = stmt.run(fullName, designation, kvName, username, email, mobile, passwordHash, role, status, approved ? 1 : 0);
    return this.findUserById(info.lastInsertRowid);
  }

  async findUserById(id) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id);
    return this._formatUser(user);
  }

  async findUserByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
    const user = stmt.get(username);
    return this._formatUser(user);
  }

  async findUserByEmail(email) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
    const user = stmt.get(email);
    return this._formatUser(user);
  }

  async findUserByUsernameOrEmail(identifier) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)');
    const user = stmt.get(identifier, identifier);
    return this._formatUser(user);
  }

  async getAllUsers() {
    const stmt = this.db.prepare('SELECT id, full_name, designation, kv_name, username, email, mobile, role, status, approved, created_at, updated_at, approved_at, approved_by FROM users ORDER BY created_at DESC');
    const users = stmt.all();
    return users.map(u => this._formatUser(u));
  }

  async updateUserStatus(id, { status, approved, approvedBy }) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE users 
      SET status = ?, approved = ?, approved_by = ?, approved_at = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(status, approved ? 1 : 0, approvedBy || 'SUPERADMIN', now, now, id);
    return this.findUserById(id);
  }

  async updateUserPassword(id, passwordHash) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(passwordHash, now, id);
    return true;
  }

  async deleteUser(id) {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ── APPLICATION METHODS ──────────────────────────────────────

  async getApplications(userId) {
    const stmt = this.db.prepare('SELECT * FROM applications WHERE user_id = ? ORDER BY created_at ASC');
    const rows = stmt.all(userId);
    return rows.map(r => this._formatApplication(r));
  }

  async bulkReplaceApplications(userId, candidates) {
    const deleteStmt = this.db.prepare('DELETE FROM applications WHERE user_id = ?');
    const insertStmt = this.db.prepare(`
      INSERT INTO applications 
        (user_id, reg_no, name, father_name, mother_name, dob, gender, class_applied, priority_cat, caste_cat, rte, distance_km, sgc, cwsn, transfers, mobile, verified, deficiency_reason, audit_log)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    const bulkInsert = this.db.transaction((userId, candidates) => {
      deleteStmt.run(userId);
      for (const c of candidates) {
        insertStmt.run(
          userId,
          c.regNo || '',
          c.name || '',
          c.fatherName || '',
          c.motherName || '',
          c.dob || '',
          c.gender || '',
          c.classApplied || '',
          c.priorityCat || '',
          c.casteCat || '',
          c.rte || 'NO',
          parseFloat(c.distanceKm) || 0,
          c.sgc || 'NO',
          c.cwsn || 'NO',
          parseInt(c.transfers) || 0,
          c.mobile || '',
          c.verified || 'PENDING',
          c.deficiencyReason || null,
          JSON.stringify(c.auditLog || {})
        );
      }
    });

    bulkInsert(userId, candidates);
  }

  async updateApplication(userId, regNo, updates) {
    const now = new Date().toISOString();
    const fieldMap = {
      verified: 'verified',
      deficiencyReason: 'deficiency_reason',
      auditLog: 'audit_log',
      priorityCat: 'priority_cat',
      rte: 'rte',
      distanceKm: 'distance_km',
      cwsn: 'cwsn',
      sgc: 'sgc',
      transfers: 'transfers',
      mobile: 'mobile'
    };

    const setParts = ['updated_at = ?'];
    const values = [now];

    for (const [key, col] of Object.entries(fieldMap)) {
      if (updates[key] !== undefined) {
        setParts.push(`${col} = ?`);
        values.push(key === 'auditLog' ? JSON.stringify(updates[key]) : updates[key]);
      }
    }

    values.push(userId, regNo);

    const stmt = this.db.prepare(`
      UPDATE applications SET ${setParts.join(', ')}
      WHERE user_id = ? AND reg_no = ?
    `);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  async deleteApplications(userId) {
    const stmt = this.db.prepare('DELETE FROM applications WHERE user_id = ?');
    stmt.run(userId);
  }

  // ── SCHOOL SETTINGS METHODS ──────────────────────────────────

  async getSchoolSettings(userId) {
    const stmt = this.db.prepare('SELECT settings_json FROM school_settings WHERE user_id = ?');
    const row = stmt.get(userId);
    if (!row) return null;
    try { return JSON.parse(row.settings_json); } catch (e) { return null; }
  }

  async saveSchoolSettings(userId, settingsObj) {
    const json = JSON.stringify(settingsObj);
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO school_settings (user_id, settings_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET settings_json = ?, updated_at = ?
    `);
    stmt.run(userId, json, now, json, now);
  }

  // ── FORMATTERS ───────────────────────────────────────────────

  _formatUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      fullName: user.full_name,
      designation: user.designation || '',
      kvName: user.kv_name || '',
      username: user.username,
      email: user.email,
      mobile: user.mobile,
      passwordHash: user.password_hash,
      role: user.role,
      status: user.status,
      approved: Boolean(user.approved),
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      approvedAt: user.approved_at,
      approvedBy: user.approved_by
    };
  }

  _formatApplication(row) {
    if (!row) return null;
    let auditLog = {};
    try { auditLog = JSON.parse(row.audit_log || '{}'); } catch (e) {}
    return {
      id: row.id,
      regNo: row.reg_no,
      name: row.name,
      fatherName: row.father_name,
      motherName: row.mother_name,
      dob: row.dob,
      gender: row.gender,
      classApplied: row.class_applied,
      priorityCat: row.priority_cat,
      casteCat: row.caste_cat,
      rte: row.rte,
      distanceKm: parseFloat(row.distance_km) || 0,
      sgc: row.sgc,
      cwsn: row.cwsn,
      transfers: parseInt(row.transfers) || 0,
      mobile: row.mobile,
      verified: row.verified,
      deficiencyReason: row.deficiency_reason,
      auditLog
    };
  }
}

module.exports = SQLiteAdapter;
