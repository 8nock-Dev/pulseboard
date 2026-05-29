-- PulseBoard Database Schema
-- Run this file to initialize or reset the database

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- MONITORS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitors (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 VARCHAR(255) NOT NULL,
  url                  TEXT NOT NULL,
  type                 VARCHAR(20) DEFAULT 'http' CHECK (type IN ('http', 'https')),
  interval_minutes     INTEGER DEFAULT 5,
  timeout_seconds      INTEGER DEFAULT 10,
  expected_status_code INTEGER DEFAULT 200,
  is_active            BOOLEAN DEFAULT true,
  current_status       VARCHAR(10) DEFAULT 'pending' CHECK (current_status IN ('up', 'down', 'pending')),
  last_checked_at      TIMESTAMPTZ,
  uptime_percentage    DECIMAL(5,2) DEFAULT 100.00,
  notify_email         VARCHAR(255),
  notify_webhook       TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- CHECKS (individual check results)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id      UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status          VARCHAR(10) NOT NULL CHECK (status IN ('up', 'down', 'timeout')),
  response_time_ms INTEGER,
  status_code     INTEGER,
  error_message   TEXT,
  checked_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INCIDENTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id       UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  duration_minutes DECIMAL(10,2),
  is_resolved      BOOLEAN DEFAULT false,
  root_cause       TEXT
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_checks_monitor_id    ON checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_checks_checked_at    ON checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_checks_monitor_time  ON checks(monitor_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_monitor_id ON incidents(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitors_user_id     ON monitors(user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_active      ON monitors(is_active) WHERE is_active = true;
