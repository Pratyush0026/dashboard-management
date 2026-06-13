-- TalenTrack Admin Dashboard Schema
-- Run this in your Supabase SQL editor

-- Admins table
CREATE TABLE IF NOT EXISTS admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Candidates table (legacy - for CSV uploads)
CREATE TABLE IF NOT EXISTS candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Datasets table (for Excel/CSV file uploads with full stats)
CREATE TABLE IF NOT EXISTS datasets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sheet_name TEXT,
  data JSONB NOT NULL DEFAULT '[]',
  columns JSONB NOT NULL DEFAULT '[]',
  column_stats JSONB,
  row_count INTEGER DEFAULT 0,
  column_count INTEGER DEFAULT 0,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Queries table
CREATE TABLE IF NOT EXISTS ai_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  dataset_id UUID REFERENCES datasets(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_candidates_admin_id ON candidates(admin_id);
CREATE INDEX IF NOT EXISTS idx_datasets_admin_id ON datasets(admin_id);
CREATE INDEX IF NOT EXISTS idx_ai_queries_admin_id ON ai_queries(admin_id);
CREATE INDEX IF NOT EXISTS idx_ai_queries_dataset_id ON ai_queries(dataset_id);
