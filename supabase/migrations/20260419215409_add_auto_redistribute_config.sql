-- Migration: Add Auto Redistribute Config to key_results
-- Description: Adds is_auto_redistributed and auto_redistribute_weights columns to support the 'Redistribuição Percentual de Fases' feature.

ALTER TABLE key_results 
ADD COLUMN IF NOT EXISTS is_auto_redistributed boolean DEFAULT false;

ALTER TABLE key_results 
ADD COLUMN IF NOT EXISTS auto_redistribute_weights jsonb DEFAULT null;

-- Add a comment explaining the format for auto_redistribute_weights
COMMENT ON COLUMN key_results.auto_redistribute_weights IS 'Stores the initial percentage weights for each check-in in a JSONB object mapping quarter_checkin_id to percentage value.';
