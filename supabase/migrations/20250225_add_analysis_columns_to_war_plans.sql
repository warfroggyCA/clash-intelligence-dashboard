-- Add missing analysis columns to war_plans table
ALTER TABLE war_plans 
ADD COLUMN IF NOT EXISTS analysis jsonb,
ADD COLUMN IF NOT EXISTS analysis_status text DEFAULT 'pending';
