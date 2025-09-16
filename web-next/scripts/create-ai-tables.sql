-- Create AI-related tables for Clash Intelligence
-- Run this in Supabase SQL Editor

-- 1. Create batch_ai_results table
CREATE TABLE IF NOT EXISTS batch_ai_results (
    id SERIAL PRIMARY KEY,
    clan_tag TEXT NOT NULL,
    date DATE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    change_summary JSONB,
    coaching_advice JSONB,
    player_dna_insights JSONB,
    clan_dna_insights JSONB,
    game_chat_messages JSONB,
    performance_analysis JSONB,
    snapshot_summary TEXT,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clan_tag, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_batch_ai_results_clan_tag ON batch_ai_results(clan_tag);
CREATE INDEX IF NOT EXISTS idx_batch_ai_results_date ON batch_ai_results(date);
CREATE INDEX IF NOT EXISTS idx_batch_ai_results_created_at ON batch_ai_results(created_at);

-- Enable RLS
ALTER TABLE batch_ai_results ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on batch_ai_results" ON batch_ai_results FOR ALL USING (true);

-- 2. Create player_dna_cache table
CREATE TABLE IF NOT EXISTS player_dna_cache (
    id SERIAL PRIMARY KEY,
    clan_tag TEXT NOT NULL,
    player_tag TEXT NOT NULL,
    date DATE NOT NULL,
    dna_profile JSONB NOT NULL,
    archetype TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clan_tag, player_tag, date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_player_dna_cache_clan_tag ON player_dna_cache(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_dna_cache_player_tag ON player_dna_cache(player_tag);
CREATE INDEX IF NOT EXISTS idx_player_dna_cache_date ON player_dna_cache(date);
CREATE INDEX IF NOT EXISTS idx_player_dna_cache_created_at ON player_dna_cache(created_at);

-- Enable RLS
ALTER TABLE player_dna_cache ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on player_dna_cache" ON player_dna_cache FOR ALL USING (true);

-- 3. Verify tables were created
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('batch_ai_results', 'player_dna_cache')
ORDER BY table_name, ordinal_position;
