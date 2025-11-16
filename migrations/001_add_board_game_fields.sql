-- Migration: Add alternate_names and publishers fields to board_games table
-- Also makes bgg_id nullable to support manual game entries

-- Add new columns
ALTER TABLE board_games
ADD COLUMN IF NOT EXISTS alternate_names TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS publishers TEXT[] DEFAULT '{}';

-- Make bgg_id nullable (to support manual game entries without BGG ID)
ALTER TABLE board_games
ALTER COLUMN bgg_id DROP NOT NULL;

-- Update existing rows to have empty arrays for new columns
UPDATE board_games
SET alternate_names = '{}', publishers = '{}'
WHERE alternate_names IS NULL OR publishers IS NULL;
