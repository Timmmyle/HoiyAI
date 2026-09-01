-- Migration: Add Learning Mode Settings, Question Difficulty, Explanation & Topics
-- Run this script in the Supabase SQL Editor

-- 1. Add learning_settings JSONB to forms table
ALTER TABLE public.forms 
ADD COLUMN IF NOT EXISTS learning_settings JSONB DEFAULT '{
  "shuffle_questions": false,
  "shuffle_answers": false,
  "attempts_limit": 0,
  "retake_mode": "entire",
  "learning_mode": "practice",
  "timer_type": "none",
  "timer_value": 0,
  "points_per_question": 10,
  "streak_bonus": false,
  "fast_bonus": false,
  "negative_marking": false,
  "partial_credit": false
}'::jsonb;

-- 2. Add difficulty, explanation, topic to questions table
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS explanation TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT NULL;
