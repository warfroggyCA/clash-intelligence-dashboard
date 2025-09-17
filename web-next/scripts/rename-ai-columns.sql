-- Rename AI-related columns to use "insights" terminology
-- This migration updates the database schema to match the new naming convention

-- Rename columns in batch_ai_results table
ALTER TABLE batch_ai_results 
RENAME COLUMN coaching_advice TO coaching_insights;

-- Add comment to document the change
COMMENT ON COLUMN batch_ai_results.coaching_insights IS 'Renamed from coaching_advice to match new insights terminology';

-- Update any existing indexes that might reference the old column name
-- (PostgreSQL will automatically update index references when columns are renamed)

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'batch_ai_results' 
AND column_name IN ('coaching_advice', 'coaching_insights')
ORDER BY column_name;
