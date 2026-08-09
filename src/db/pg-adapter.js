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

  // ── USER METHODS ─────────────────────────────────────────────

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

  // ── APPLICATION METHODS ──────────────────────────────────────

  async getApplications(userId) {
    const res = await this.pool.query(
      'SELECT * FROM applications WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );
    return res.rows.map(r => this._formatApplication(r));
  }

  async bulkReplaceApplications(userId, candidates) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Delete all existing records for this user
      await client.query('DELETE FROM applications WHERE user_id = $1', [userId]);

      if (candidates.length > 0) {
        const insertQuery = `
          INSERT INTO applications 
            (user_id, reg_no, name, father_name, mother_name, dob, gender, class_applied, priority_cat, caste_cat, rte, distance_km, sgc, cwsn, transfers, mobile, verified, deficiency_reason, audit_log)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        `;
        for (const c of candidates) {
          await client.query(insertQuery, [
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
          ]);
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateApplication(userId, regNo, updates) {
    const fields = [];
    const values = [];
    let idx = 1;

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

    for (const [key, col] of Object.entries(fieldMap)) {
      if (updates[key] !== undefined) {
        fields.push(`${col} = $${idx}`);
        values.push(key === 'auditLog' ? JSON.stringify(updates[key]) : updates[key]);
        idx++;
      }
    }

    if (fields.length === 0) return false;

    fields.push(`updated_at = NOW()`);
    values.push(userId, regNo);

    const query = `
      UPDATE applications SET ${fields.join(', ')}
      WHERE user_id = $${idx} AND reg_no = $${idx + 1}
    `;
    const res = await this.pool.query(query, values);
    return res.rowCount > 0;
  }

  async deleteApplications(userId) {
    await this.pool.query('DELETE FROM applications WHERE user_id = $1', [userId]);
  }

  // ── SCHOOL SETTINGS METHODS ──────────────────────────────────

  async getSchoolSettings(userId) {
    const res = await this.pool.query(
      'SELECT settings_json FROM school_settings WHERE user_id = $1',
      [userId]
    );
    if (res.rows.length === 0) return null;
    const raw = res.rows[0].settings_json;
    return typeof raw === 'object' ? raw : JSON.parse(raw);
  }

  async saveSchoolSettings(userId, settingsObj) {
    const query = `
      INSERT INTO school_settings (user_id, settings_json, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) DO UPDATE
        SET settings_json = $2, updated_at = NOW()
    `;
    await this.pool.query(query, [userId, JSON.stringify(settingsObj)]);
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
    try {
      auditLog = typeof row.audit_log === 'object' ? row.audit_log : JSON.parse(row.audit_log || '{}');
    } catch (e) {}
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

module.exports = PGAdapter;
