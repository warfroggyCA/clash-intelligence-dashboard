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

-- Create ai_summaries table (legacy)
CREATE TABLE ai_summaries (
  id BIGSERIAL PRIMARY KEY,
  clan_tag TEXT NOT NULL,
  date TEXT NOT NULL,
  summary TEXT NOT NULL,
  summary_type TEXT DEFAULT 'full_analysis',
  unread BOOLEAN DEFAULT true,
  actioned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create batch_ai_results table for comprehensive AI processing
CREATE TABLE batch_ai_results (
  id BIGSERIAL PRIMARY KEY,
  clan_tag TEXT NOT NULL,
  date TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  change_summary JSONB,
  coaching_advice JSONB,
  coaching_insights JSONB,
  player_dna_insights JSONB,
  clan_dna_insights JSONB,
  game_chat_messages JSONB,
  performance_analysis JSONB,
  smart_insights_payload JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create player_dna_cache table for caching DNA calculations
CREATE TABLE player_dna_cache (
  id BIGSERIAL PRIMARY KEY,
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  date TEXT NOT NULL,
  dna_profile JSONB NOT NULL,
  archetype TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clan_tag, player_tag, date)
);

-- Create clan_snapshots table for full snapshot data
CREATE TABLE clan_snapshots (
  id BIGSERIAL PRIMARY KEY,
  clan_tag TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
  clan JSONB NOT NULL,
  member_summaries JSONB NOT NULL,
  player_details JSONB NOT NULL,
  current_war JSONB,
  war_log JSONB NOT NULL,
  capital_seasons JSONB NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clan_tag, snapshot_date)
);

-- Create indexes for better performance
CREATE INDEX idx_snapshots_clan_tag ON snapshots(clan_tag);
CREATE INDEX idx_snapshots_date ON snapshots(date);
CREATE INDEX idx_snapshots_timestamp ON snapshots(timestamp);
CREATE INDEX idx_ai_summaries_clan_tag ON ai_summaries(clan_tag);
CREATE INDEX idx_ai_summaries_date ON ai_summaries(date);
CREATE INDEX idx_ai_summaries_created_at ON ai_summaries(created_at);
CREATE INDEX idx_batch_ai_results_clan_tag ON batch_ai_results(clan_tag);
CREATE INDEX idx_batch_ai_results_date ON batch_ai_results(date);
CREATE INDEX idx_batch_ai_results_timestamp ON batch_ai_results(timestamp);
CREATE INDEX idx_player_dna_cache_clan_tag ON player_dna_cache(clan_tag);
CREATE INDEX idx_player_dna_cache_player_tag ON player_dna_cache(player_tag);
CREATE INDEX idx_player_dna_cache_date ON player_dna_cache(date);
CREATE INDEX idx_clan_snapshots_clan_tag ON clan_snapshots(clan_tag);
CREATE INDEX idx_clan_snapshots_snapshot_date ON clan_snapshots(snapshot_date);
CREATE INDEX idx_clan_snapshots_fetched_at ON clan_snapshots(fetched_at);

-- Enable Row Level Security (RLS)
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenure_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_ai_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_dna_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE clan_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, you can restrict later)
CREATE POLICY "Allow all operations on snapshots" ON snapshots FOR ALL USING (true);
CREATE POLICY "Allow all operations on tenure_ledger" ON tenure_ledger FOR ALL USING (true);
CREATE POLICY "Allow all operations on ai_summaries" ON ai_summaries FOR ALL USING (true);
CREATE POLICY "Allow all operations on batch_ai_results" ON batch_ai_results FOR ALL USING (true);
CREATE POLICY "Allow all operations on player_dna_cache" ON player_dna_cache FOR ALL USING (true);
CREATE POLICY "Allow all operations on clan_snapshots" ON clan_snapshots FOR ALL USING (true);

-- Create storage bucket for files
INSERT INTO storage.buckets (id, name, public) VALUES ('snapshots', 'snapshots', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('tenure', 'tenure', true);

-- Create storage policies
CREATE POLICY "Allow public read access to snapshots" ON storage.objects FOR SELECT USING (bucket_id = 'snapshots');
CREATE POLICY "Allow public read access to tenure" ON storage.objects FOR SELECT USING (bucket_id = 'tenure');
CREATE POLICY "Allow authenticated upload to snapshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'snapshots');
CREATE POLICY "Allow authenticated upload to tenure" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tenure');
