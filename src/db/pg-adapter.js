const { Pool } = require('pg');
const { PG_SCHEMA } = require('./schema');

class PGAdapter {
  constructor(connectionString) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes('supabase') || process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false
    });
  }

  async init() {
    const client = await this.pool.connect();
    try {
      await client.query(PG_SCHEMA);
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(255) DEFAULT '';");
      await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS kv_name VARCHAR(255) DEFAULT '';");
      console.log('[PostgreSQL Database] Initialized successfully.');
    } finally {
      client.release();
    }
  }

  async createUser({ fullName, designation = '', kvName = '', username, email, mobile, passwordHash, role = 'USER', status = 'PENDING', approved = false }) {
    const query = `
      INSERT INTO users (full_name, designation, kv_name, username, email, mobile, password_hash, role, status, approved, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *;
    `;
    const values = [fullName, designation, kvName, username, email, mobile, passwordHash, role, status, Boolean(approved)];
    const res = await this.pool.query(query, values);
    return this._formatUser(res.rows[0]);
  }

  async findUserById(id) {
    const res = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return this._formatUser(res.rows[0]);
  }

  async findUserByUsername(username) {
    const res = await this.pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    return this._formatUser(res.rows[0]);
  }

  async findUserByEmail(email) {
    const res = await this.pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    return this._formatUser(res.rows[0]);
  }

  async findUserByUsernameOrEmail(identifier) {
    const res = await this.pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)', [identifier]);
    return this._formatUser(res.rows[0]);
  }

  async getAllUsers() {
    const res = await this.pool.query('SELECT id, full_name, designation, kv_name, username, email, mobile, role, status, approved, created_at, updated_at, approved_at, approved_by FROM users ORDER BY created_at DESC');
    return res.rows.map(u => this._formatUser(u));
  }

  async updateUserStatus(id, { status, approved, approvedBy }) {
    const query = `
      UPDATE users 
      SET status = $1, approved = $2, approved_by = $3, approved_at = NOW(), updated_at = NOW()
      WHERE id = $4
      RETURNING *;
    `;
    const res = await this.pool.query(query, [status, Boolean(approved), approvedBy || 'SUPERADMIN', id]);
    return this._formatUser(res.rows[0]);
  }

  async updateUserPassword(id, passwordHash) {
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
    `;
    const res = await this.pool.query(query, [passwordHash, id]);
    return res.rowCount > 0;
  }

  async deleteUser(id) {
    const res = await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
    return res.rowCount > 0;
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

module.exports = PGAdapter;
