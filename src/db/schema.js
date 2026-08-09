/**
 * Database Schema & Table Definitions
 * Supports both SQLite (local dev) and PostgreSQL (Supabase production)
 */

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  designation TEXT DEFAULT '',
  kv_name TEXT DEFAULT '',
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  status TEXT NOT NULL DEFAULT 'PENDING',
  approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  approved_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reg_no TEXT,
  name TEXT,
  father_name TEXT,
  mother_name TEXT,
  dob TEXT,
  gender TEXT,
  class_applied TEXT,
  priority_cat TEXT,
  caste_cat TEXT,
  rte TEXT DEFAULT 'NO',
  distance_km REAL DEFAULT 0,
  sgc TEXT DEFAULT 'NO',
  cwsn TEXT DEFAULT 'NO',
  transfers INTEGER DEFAULT 0,
  mobile TEXT,
  verified TEXT DEFAULT 'PENDING',
  deficiency_reason TEXT,
  audit_log TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_reg_no ON applications(reg_no);

CREATE TABLE IF NOT EXISTS school_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  settings_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

const PG_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  designation VARCHAR(255) DEFAULT '',
  kv_name VARCHAR(255) DEFAULT '',
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  mobile VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'USER',
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMPTZ,
  approved_by VARCHAR(100)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reg_no VARCHAR(150),
  name VARCHAR(255),
  father_name VARCHAR(255),
  mother_name VARCHAR(255),
  dob VARCHAR(30),
  gender VARCHAR(20),
  class_applied VARCHAR(30),
  priority_cat VARCHAR(30),
  caste_cat VARCHAR(30),
  rte VARCHAR(10) DEFAULT 'NO',
  distance_km DECIMAL(6,2) DEFAULT 0,
  sgc VARCHAR(10) DEFAULT 'NO',
  cwsn VARCHAR(10) DEFAULT 'NO',
  transfers INTEGER DEFAULT 0,
  mobile VARCHAR(20),
  verified VARCHAR(50) DEFAULT 'PENDING',
  deficiency_reason TEXT,
  audit_log JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_reg_no ON applications(reg_no);

CREATE TABLE IF NOT EXISTS school_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  settings_json JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
`;

module.exports = {
  SQLITE_SCHEMA,
  PG_SCHEMA
};
