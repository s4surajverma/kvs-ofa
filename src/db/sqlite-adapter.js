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
}

module.exports = SQLiteAdapter;
