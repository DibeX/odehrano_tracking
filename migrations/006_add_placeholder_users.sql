-- Migration: Add support for placeholder users (users without auth accounts)
-- These users can be created by admins and later activated by linking to an auth account

-- Step 1: Add new columns first
ALTER TABLE users ADD COLUMN auth_user_id UUID;
ALTER TABLE users ADD COLUMN is_placeholder BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 2: Migrate existing data - copy id to auth_user_id for existing users
UPDATE users SET auth_user_id = id;

-- Step 3: Add foreign key constraint for auth_user_id
ALTER TABLE users ADD CONSTRAINT users_auth_user_id_fkey
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 4: Drop foreign keys that reference users.id (we'll recreate them)
ALTER TABLE played_games DROP CONSTRAINT IF EXISTS played_games_created_by_fkey;
ALTER TABLE played_game_players DROP CONSTRAINT IF EXISTS played_game_players_user_id_fkey;
ALTER TABLE played_game_comments DROP CONSTRAINT IF EXISTS played_game_comments_user_id_fkey;
ALTER TABLE user_game_rankings DROP CONSTRAINT IF EXISTS user_game_rankings_user_id_fkey;
ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_created_by_fkey;
ALTER TABLE category_presets DROP CONSTRAINT IF EXISTS category_presets_created_by_fkey;

-- Step 5: Drop the foreign key to auth.users from the id column FIRST
-- This FK constraint is created when using "REFERENCES" in the table definition
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Step 6: Drop the old primary key constraint
ALTER TABLE users DROP CONSTRAINT users_pkey;

-- Step 7: Make id a regular UUID primary key with auto-generation
ALTER TABLE users ALTER COLUMN id SET DEFAULT uuid_generate_v4();
ALTER TABLE users ADD PRIMARY KEY (id);

-- Step 8: Recreate foreign keys to users.id
ALTER TABLE played_games ADD CONSTRAINT played_games_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE played_game_players ADD CONSTRAINT played_game_players_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE played_game_comments ADD CONSTRAINT played_game_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_game_rankings ADD CONSTRAINT user_game_rankings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_invitations ADD CONSTRAINT user_invitations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE category_presets ADD CONSTRAINT category_presets_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- Step 9: Make email nullable for placeholder users
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Step 10: Add unique constraint on email where not null (allows multiple nulls)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX users_email_unique ON users(email) WHERE email IS NOT NULL;

-- Step 11: Add a unique constraint on auth_user_id (if not null)
CREATE UNIQUE INDEX users_auth_user_id_unique ON users(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Update the handle_new_user trigger to use auth_user_id
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip user creation if this is a placeholder user activation
  IF (NEW.raw_user_meta_data->>'skip_user_creation')::boolean = TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users (id, auth_user_id, email, nickname, role, is_placeholder)
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'player'),
    FALSE
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- If user already exists, just return NEW
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies to handle auth_user_id
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Add policy to allow admins to insert placeholder users
-- (existing "Admins can insert users" policy should still work)

-- Add index for auth_user_id lookups
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_users_is_placeholder ON users(is_placeholder);

-- Update foreign key references to use users.id instead of auth.users.id
-- These should already work since we're keeping the same id values for existing users

-- Add a function to link a placeholder user to an auth account
CREATE OR REPLACE FUNCTION link_placeholder_user_to_auth(
  p_user_id UUID,
  p_auth_user_id UUID,
  p_email TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    auth_user_id = p_auth_user_id,
    email = p_email,
    is_placeholder = FALSE,
    updated_at = NOW()
  WHERE id = p_user_id AND is_placeholder = TRUE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add placeholder_user_id to user_invitations for linking placeholder users during activation
ALTER TABLE user_invitations ADD COLUMN placeholder_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add index for placeholder_user_id lookups
CREATE INDEX idx_user_invitations_placeholder_user_id ON user_invitations(placeholder_user_id);
