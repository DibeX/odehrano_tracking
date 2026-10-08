-- BGG ratings are on a 0-10 scale. DECIMAL(3,2) cannot store a rating of 10.00.
-- This migration changes storage precision without changing existing values.
ALTER TABLE public.board_games
  ALTER COLUMN bgg_rating TYPE NUMERIC(4,2);
