-- schema.sql
-- PostgreSQL Schema for Website Survey AI
-- Designed for Supabase

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (linked to Supabase Auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) for profiles
alter table public.profiles enable row level security;

-- Create policies for profiles
create policy "Public profiles are viewable by everyone" 
  on public.profiles for select using (true);

create policy "Users can update their own profile" 
  on public.profiles for update using (auth.uid() = id);

-- Trigger to create profile when auth.user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. Forms Table
create table public.forms (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references public.profiles(id) on delete cascade not null
);

alter table public.forms enable row level security;

-- Policies for Forms
create policy "Forms are viewable by everyone (public access to answer)"
  on public.forms for select using (true);

create policy "Users can insert their own forms"
  on public.forms for insert with check (auth.uid() = user_id);

create policy "Users can update their own forms"
  on public.forms for update using (auth.uid() = user_id);

create policy "Users can delete their own forms"
  on public.forms for delete using (auth.uid() = user_id);


-- 3. Questions Table (supporting branching logic)
create table public.questions (
  id uuid default uuid_generate_v4() primary key,
  form_id uuid references public.forms(id) on delete cascade not null,
  type text not null check (type in ('radio', 'checkbox', 'text', 'textarea', 'voice', 'quiz_radio', 'scale', 'dropdown', 'matrix', 'date', 'file')),
  text text not null,
  options jsonb default '[]'::jsonb, -- array of option strings or key-value pairs
  correct_answer text, -- for quiz questions
  is_required boolean default false not null,
  order_index integer default 0 not null,
  
  -- Branching logic fields
  is_branching_question boolean default false not null,
  visibility_type text default 'always'::text check (visibility_type in ('always', 'conditional')),
  condition_question_id uuid references public.questions(id) on delete set null,
  condition_value text
);

alter table public.questions enable row level security;

-- Policies for Questions
create policy "Questions are viewable by everyone (public access to answer)"
  on public.questions for select using (true);

create policy "Users can modify questions of their own forms"
  on public.questions for all using (
    exists (
      select 1 from public.forms
      where forms.id = questions.form_id and forms.user_id = auth.uid()
    )
  );


-- 4. Responses Table
create table public.responses (
  id uuid default uuid_generate_v4() primary key,
  form_id uuid references public.forms(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_agent text,
  ip_address text
);

alter table public.responses enable row level security;

-- Policies for Responses
create policy "Anyone can insert responses"
  on public.responses for insert with check (true);

create policy "Form owners can view responses"
  on public.responses for select using (
    exists (
      select 1 from public.forms
      where forms.id = responses.form_id and forms.user_id = auth.uid()
    )
  );


-- 5. Answers Table
create table public.answers (
  id uuid default uuid_generate_v4() primary key,
  response_id uuid references public.responses(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  value text, -- standard answers stored as string, checkboxes can be JSON stringified
  audio_url text -- for voice answers stored in Supabase storage
);

alter table public.answers enable row level security;

-- Policies for Answers
create policy "Anyone can insert answers"
  on public.answers for insert with check (true);

create policy "Form owners can view answers"
  on public.answers for select using (
    exists (
      select 1 from public.responses r
      join public.forms f on f.id = r.form_id
      where r.id = answers.response_id and f.user_id = auth.uid()
    )
  );
