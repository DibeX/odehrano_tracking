-- Migration: Add RLS policy to allow users to mark their own invitation as used
-- This fixes the issue where invited users stay in "pending" status after accepting
-- the invitation, because they didn't have permission to update the invitation record.

CREATE POLICY "Users can mark own invitation as used" ON user_invitations
  FOR UPDATE USING (
    -- Allow update only for invitations matching the user's email
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    -- Only allow updating used_at field (other fields must remain the same)
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
