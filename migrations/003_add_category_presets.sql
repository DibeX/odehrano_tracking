-- Migration: Add category_presets table for saving category filter presets
-- Admins and moderators can create presets that group multiple categories together

CREATE TABLE category_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  categories TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX idx_category_presets_created_by ON category_presets(created_by);
CREATE INDEX idx_category_presets_is_public ON category_presets(is_public);

-- Add updated_at trigger
CREATE TRIGGER update_category_presets_updated_at BEFORE UPDATE ON category_presets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE category_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can view public presets
CREATE POLICY "Everyone can view public category presets" ON category_presets
  FOR SELECT USING (is_public = true);

-- Users can view their own presets
CREATE POLICY "Users can view own category presets" ON category_presets
  FOR SELECT USING (auth.uid() = created_by);

-- Admins and moderators can create presets
CREATE POLICY "Admins and moderators can create category presets" ON category_presets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Admins and moderators can update their own presets
CREATE POLICY "Admins and moderators can update own category presets" ON category_presets
  FOR UPDATE USING (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Admins and moderators can delete their own presets
CREATE POLICY "Admins and moderators can delete own category presets" ON category_presets
  FOR DELETE USING (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Admins can manage all presets
CREATE POLICY "Admins can manage all category presets" ON category_presets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
