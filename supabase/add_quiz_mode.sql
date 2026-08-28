-- add_quiz_mode.sql
-- Run this SQL in your Supabase Dashboard SQL Editor to add Quiz Mode support to the forms table.

ALTER TABLE public.forms 
ADD COLUMN IF NOT EXISTS is_quiz boolean DEFAULT false NOT NULL;
