-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('admin', 'moderator', 'player');

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  description TEXT,
  role user_role NOT NULL DEFAULT 'player',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User invitations table
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'player',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Board games table
CREATE TABLE board_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bgg_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  original_name TEXT,
  image_url TEXT,
  year_published INTEGER,
  categories TEXT[] DEFAULT '{}',
  bgg_rank INTEGER,
  bgg_rating DECIMAL(3, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Played games table
CREATE TABLE played_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_game_id UUID NOT NULL REFERENCES board_games(id) ON DELETE CASCADE,
  custom_name TEXT,
  played_at DATE NOT NULL,
  note TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Played game players table
CREATE TABLE played_game_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  played_game_id UUID NOT NULL REFERENCES played_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score DECIMAL(10, 2),
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(played_game_id, user_id)
);

-- Played game comments table
CREATE TABLE played_game_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  played_game_id UUID NOT NULL REFERENCES played_games(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ranking years table
CREATE TABLE ranking_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INTEGER UNIQUE NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User game rankings table
CREATE TABLE user_game_rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_game_id UUID NOT NULL REFERENCES board_games(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  rank INTEGER NOT NULL CHECK (rank > 0),
  is_manually_added BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, board_game_id, year),
  UNIQUE(user_id, year, rank)
);

-- Create indexes for better query performance
CREATE INDEX idx_users_nickname ON users(nickname);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_invitations_token ON user_invitations(token);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_board_games_bgg_id ON board_games(bgg_id);
CREATE INDEX idx_played_games_board_game_id ON played_games(board_game_id);
CREATE INDEX idx_played_games_played_at ON played_games(played_at);
CREATE INDEX idx_played_game_players_user_id ON played_game_players(user_id);
CREATE INDEX idx_played_game_comments_played_game_id ON played_game_comments(played_game_id);
CREATE INDEX idx_ranking_years_year ON ranking_years(year);
CREATE INDEX idx_user_game_rankings_user_year ON user_game_rankings(user_id, year);
CREATE INDEX idx_user_game_rankings_year ON user_game_rankings(year);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_board_games_updated_at BEFORE UPDATE ON board_games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_played_games_updated_at BEFORE UPDATE ON played_games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_played_game_comments_updated_at BEFORE UPDATE ON played_game_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ranking_years_updated_at BEFORE UPDATE ON ranking_years
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_game_rankings_updated_at BEFORE UPDATE ON user_game_rankings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE played_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE played_game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE played_game_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_game_rankings ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view all profiles" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can insert users" ON users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- User invitations policies
CREATE POLICY "Admins can manage invitations" ON user_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Anyone can view valid invitations by token" ON user_invitations
  FOR SELECT USING (used_at IS NULL AND expires_at > NOW());

-- Board games policies
CREATE POLICY "Everyone can view board games" ON board_games
  FOR SELECT USING (true);

CREATE POLICY "Admins and moderators can manage board games" ON board_games
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Played games policies
CREATE POLICY "Everyone can view played games" ON played_games
  FOR SELECT USING (true);

CREATE POLICY "Admins and moderators can manage played games" ON played_games
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Played game players policies
CREATE POLICY "Everyone can view played game players" ON played_game_players
  FOR SELECT USING (true);

CREATE POLICY "Admins and moderators can manage played game players" ON played_game_players
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Played game comments policies
CREATE POLICY "Everyone can view comments" ON played_game_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create own comments" ON played_game_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON played_game_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON played_game_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all comments" ON played_game_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Ranking years policies
CREATE POLICY "Everyone can view ranking years" ON ranking_years
  FOR SELECT USING (true);

CREATE POLICY "Admins and moderators can manage ranking years" ON ranking_years
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- User game rankings policies
CREATE POLICY "Everyone can view public rankings" ON user_game_rankings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ranking_years
      WHERE year = user_game_rankings.year AND is_public = true
    )
  );

CREATE POLICY "Users can view own rankings" ON user_game_rankings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins and moderators can view all rankings" ON user_game_rankings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Users can manage own rankings for unlocked years" ON user_game_rankings
  FOR ALL USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM ranking_years
      WHERE year = user_game_rankings.year AND is_locked = false
    )
  );

CREATE POLICY "Admins and moderators can manage all rankings" ON user_game_rankings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, nickname, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'player')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
