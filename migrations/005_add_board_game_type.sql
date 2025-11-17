-- Migration: Add game_type column to board_games table
-- This column stores the broader category type of board games

-- Create enum type for board game types
CREATE TYPE board_game_type AS ENUM (
  'abstract_strategy',
  'customizable',
  'thematic',
  'family',
  'children',
  'party',
  'strategy',
  'wargames'
);

-- Add game_type column to board_games table
ALTER TABLE board_games
ADD COLUMN game_type board_game_type;

-- Create index for better query performance on game_type
CREATE INDEX idx_board_games_game_type ON board_games(game_type);
