-- ============================================================
-- CANDIDATE MANAGEMENT DASHBOARD DATABASE SCHEMA
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Candidates Table
-- Unique constraint on (admin_id, email) prevents duplicate uploads
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  position_applied TEXT NOT NULL,
  education TEXT,
  experience_years INTEGER DEFAULT 0,
  skills TEXT,
  salary_expectation TEXT,
  location TEXT,
  status TEXT DEFAULT 'Applied' CHECK (status IN ('Applied', 'Interviewing', 'Offer', 'Rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(admin_id, email)
);

-- 3. Upload Sessions Table (tracks each Excel upload for history)
CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. AI Queries Table (persists chat history)
CREATE TABLE IF NOT EXISTS ai_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_candidates_admin_id ON candidates(admin_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_position ON candidates(position_applied);
CREATE INDEX IF NOT EXISTS idx_candidates_location ON candidates(location);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_admin_id ON upload_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_ai_queries_admin_id ON ai_queries(admin_id);
CREATE INDEX IF NOT EXISTS idx_ai_queries_created_at ON ai_queries(created_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_queries ENABLE ROW LEVEL SECURITY;

-- Admin users: read own record only
CREATE POLICY IF NOT EXISTS "admins_read_own" ON admin_users
  FOR SELECT USING (auth.uid()::TEXT = id::TEXT);

-- Candidates: full CRUD scoped to own admin_id
CREATE POLICY IF NOT EXISTS "candidates_select_own" ON candidates
  FOR SELECT USING (admin_id = auth.uid()::UUID);
CREATE POLICY IF NOT EXISTS "candidates_insert_own" ON candidates
  FOR INSERT WITH CHECK (admin_id = auth.uid()::UUID);
CREATE POLICY IF NOT EXISTS "candidates_update_own" ON candidates
  FOR UPDATE USING (admin_id = auth.uid()::UUID);
CREATE POLICY IF NOT EXISTS "candidates_delete_own" ON candidates
  FOR DELETE USING (admin_id = auth.uid()::UUID);

-- Upload sessions: scoped to own admin_id
CREATE POLICY IF NOT EXISTS "upload_sessions_select_own" ON upload_sessions
  FOR SELECT USING (admin_id = auth.uid()::UUID);
CREATE POLICY IF NOT EXISTS "upload_sessions_insert_own" ON upload_sessions
  FOR INSERT WITH CHECK (admin_id = auth.uid()::UUID);

-- AI queries: scoped to own admin_id
CREATE POLICY IF NOT EXISTS "ai_queries_select_own" ON ai_queries
  FOR SELECT USING (admin_id = auth.uid()::UUID);
CREATE POLICY IF NOT EXISTS "ai_queries_insert_own" ON ai_queries
  FOR INSERT WITH CHECK (admin_id = auth.uid()::UUID);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
