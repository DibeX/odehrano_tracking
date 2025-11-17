-- Verification script for placeholder users migration
-- Run this to check that everything is set up correctly

-- 1. Check users table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Expected:
-- - id: uuid, NO, uuid_generate_v4()
-- - auth_user_id: uuid, YES, null
-- - email: text, YES (was NO before migration)
-- - nickname: text, NO
-- - is_placeholder: boolean, NO, false
-- ... other columns

-- 2. Check constraints on users table
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY constraint_type, constraint_name;

-- Expected:
-- - users_pkey (PRIMARY KEY)
-- - users_nickname_key (UNIQUE)
-- - users_auth_user_id_fkey (FOREIGN KEY) - points to auth.users
-- - NOT: users_id_fkey (this should be GONE!)

-- 3. Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users' AND schemaname = 'public';

-- Expected indexes include:
-- - users_email_unique (partial unique on email where not null)
-- - users_auth_user_id_unique (partial unique on auth_user_id where not null)
-- - idx_users_auth_user_id
-- - idx_users_is_placeholder

-- 4. Check user_invitations has placeholder_user_id column
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_invitations' AND column_name = 'placeholder_user_id';

-- Expected: placeholder_user_id, uuid, YES

-- 5. Check the handle_new_user function exists and is updated
SELECT prosrc
FROM pg_proc
WHERE proname = 'handle_new_user';

-- Should contain: skip_user_creation check and auth_user_id in INSERT

-- 6. Check RLS policy for users table
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.users'::regclass;

-- Should have "Users can update own profile" policy

-- 7. Test: Verify you can insert a placeholder user (DRY RUN - rollback)
BEGIN;

INSERT INTO users (nickname, is_placeholder, role)
VALUES ('TEST_PLACEHOLDER_USER', true, 'player')
RETURNING id, nickname, email, auth_user_id, is_placeholder;

-- Should succeed and return:
-- - id: auto-generated UUID
-- - email: NULL
-- - auth_user_id: NULL
-- - is_placeholder: true

ROLLBACK; -- Don't actually create the test user

-- 8. Summary check - count key indicators
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'users' AND column_name = 'auth_user_id') as has_auth_user_id,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'users' AND column_name = 'is_placeholder') as has_is_placeholder,
  (SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE table_name = 'users' AND constraint_name = 'users_id_fkey') as has_old_fk_constraint,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = 'user_invitations' AND column_name = 'placeholder_user_id') as has_placeholder_user_id_in_invitations;

-- Expected: 1, 1, 0, 1
-- (has new columns, does NOT have old FK constraint)
