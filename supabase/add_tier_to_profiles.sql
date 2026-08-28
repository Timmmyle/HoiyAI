-- add_tier_to_profiles.sql
-- Run this SQL in your Supabase Dashboard SQL Editor to upgrade the profiles schema.

-- Add tier and full_name columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tier text DEFAULT 'FREE' CHECK (tier in ('FREE', 'BASIC', 'PRO')) NOT NULL,
ADD COLUMN IF NOT EXISTS full_name text;

-- Recreate trigger helper handle_new_user to include default tier
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, tier)
  VALUES (new.id, new.email, 'FREE')
  ON CONFLICT (id) DO UPDATE 
  SET email = excluded.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
