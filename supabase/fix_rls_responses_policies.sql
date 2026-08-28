-- fix_rls_responses_policies.sql
-- Run this SQL in your Supabase Dashboard SQL Editor to allow anyone (including guest users who are not logged in) to submit survey responses.

-- 1. Enable RLS on responses and answers tables (if not already enabled)
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing insert policies if they exist to avoid conflict errors
DROP POLICY IF EXISTS "Anyone can insert responses" ON public.responses;
DROP POLICY IF EXISTS "Anyone can insert answers" ON public.answers;

-- 3. Create public insert policies allowing both guest (anon) and authenticated users to submit responses
CREATE POLICY "Anyone can insert responses" ON public.responses 
  FOR INSERT 
  TO anon, authenticated, service_role 
  WITH CHECK (true);

CREATE POLICY "Anyone can insert answers" ON public.answers 
  FOR INSERT 
  TO anon, authenticated, service_role 
  WITH CHECK (true);

-- 4. Enable public select access on forms and questions (so guest users can load the survey questions to fill them out)
DROP POLICY IF EXISTS "Forms are viewable by everyone (public access to answer)" ON public.forms;
CREATE POLICY "Forms are viewable by everyone (public access to answer)" ON public.forms
  FOR SELECT 
  TO anon, authenticated, service_role
  USING (true);

DROP POLICY IF EXISTS "Questions are viewable by everyone (public access to answer)" ON public.questions;
CREATE POLICY "Questions are viewable by everyone (public access to answer)" ON public.questions
  FOR SELECT 
  TO anon, authenticated, service_role
  USING (true);
