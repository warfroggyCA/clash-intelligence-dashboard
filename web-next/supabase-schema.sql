-- Supabase schema for Clash Intelligence app
-- Run this in your Supabase SQL editor

-- Create snapshots table
CREATE TABLE snapshots (
  id BIGSERIAL PRIMARY KEY,
  clan_tag TEXT NOT NULL,
  filename TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  member_count INTEGER NOT NULL,
  clan_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tenure_ledger table
CREATE TABLE tenure_ledger (
  id BIGSERIAL PRIMARY KEY,
  file_url TEXT NOT NULL UNIQUE,
  size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_snapshots_clan_tag ON snapshots(clan_tag);
CREATE INDEX idx_snapshots_date ON snapshots(date);
CREATE INDEX idx_snapshots_timestamp ON snapshots(timestamp);

-- Enable Row Level Security (RLS)
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenure_ledger ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, you can restrict later)
CREATE POLICY "Allow all operations on snapshots" ON snapshots FOR ALL USING (true);
CREATE POLICY "Allow all operations on tenure_ledger" ON tenure_ledger FOR ALL USING (true);

-- Create storage bucket for files
INSERT INTO storage.buckets (id, name, public) VALUES ('snapshots', 'snapshots', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('tenure', 'tenure', true);

-- Create storage policies
CREATE POLICY "Allow public read access to snapshots" ON storage.objects FOR SELECT USING (bucket_id = 'snapshots');
CREATE POLICY "Allow public read access to tenure" ON storage.objects FOR SELECT USING (bucket_id = 'tenure');
CREATE POLICY "Allow authenticated upload to snapshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'snapshots');
CREATE POLICY "Allow authenticated upload to tenure" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tenure');
