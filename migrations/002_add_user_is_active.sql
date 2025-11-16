-- Add is_active column to users table for soft delete functionality
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Add last_login_at column to track user login times
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Create index for filtering active users
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
