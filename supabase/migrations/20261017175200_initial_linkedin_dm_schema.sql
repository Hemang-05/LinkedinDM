-- ==============================================================================
-- LinkedInDM — Initial Database Schema Migration
-- Migration: 20261017175200_initial_linkedin_dm_schema.sql
-- Tables: profiles, connections, outreach_events, imports
-- Constraints: foreign keys, check constraints, unique(user_id, linkedin_url)
-- Indexes: performance indexes for status, category, score, connected_on, due events
-- Security: Row Level Security (RLS) enabled on all tables with user isolation
-- ==============================================================================

-- Ensure pgcrypto extension is available for UUID generation
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Profiles Table
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  experience text,
  skills text[],
  target_roles text[],
  location text,
  work_preference text,
  agency_info jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 2. Connections Table (One row represents one LinkedIn connection per user)
-- ------------------------------------------------------------------------------
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  linkedin_url text not null,

  name text,
  first_name text,
  last_name text,
  company text,
  position text,
  email text,
  phone text,

  category text,
  score integer,

  connected_on date,

  status text not null default 'new'
    check (status in ('new', 'contacted', 'skipped')),

  contacted_at timestamptz,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Extra columns for full application state fidelity
  location text,
  notes text,
  headline text,
  raw_data jsonb,

  unique(user_id, linkedin_url)
);

-- ------------------------------------------------------------------------------
-- 3. Outreach Events Table (Initial outreach and Day 5 / Day 12 follow-ups)
-- ------------------------------------------------------------------------------
create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  connection_id uuid not null
    references public.connections(id) on delete cascade,

  type text not null
    check (type in ('initial', 'follow_up')),

  sequence_number integer not null default 0,

  message text,

  scheduled_for timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 4. Imports Table (Audit history of LinkedIn CSV imports)
-- ------------------------------------------------------------------------------
create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id) on delete cascade,

  archive_requested_at timestamptz,
  archive_received_at timestamptz,
  imported_at timestamptz not null default now(),

  total_rows integer not null default 0,
  candidate_rows integer not null default 0,
  new_connections integer not null default 0,

  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 5. Indexes
-- ------------------------------------------------------------------------------
create index if not exists connections_user_status_idx
  on public.connections(user_id, status);

create index if not exists connections_user_category_status_idx
  on public.connections(user_id, category, status);

create index if not exists connections_user_score_idx
  on public.connections(user_id, score desc);

create index if not exists connections_user_connected_on_idx
  on public.connections(user_id, connected_on);

create index if not exists outreach_events_due_idx
  on public.outreach_events(user_id, scheduled_for)
  where completed_at is null;

create index if not exists outreach_events_connection_idx
  on public.outreach_events(connection_id);

-- ------------------------------------------------------------------------------
-- 6. Row Level Security (RLS) & Isolation Policies
-- ------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.connections enable row level security;
alter table public.outreach_events enable row level security;
alter table public.imports enable row level security;

-- Drop existing policies if re-applying
drop policy if exists "Users can manage own profile" on public.profiles;
drop policy if exists "Users can manage own connections" on public.connections;
drop policy if exists "Users can manage own outreach events" on public.outreach_events;
drop policy if exists "Users can manage own imports" on public.imports;

create policy "Users can manage own profile"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Users can manage own connections"
  on public.connections for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can manage own outreach events"
  on public.outreach_events for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can manage own imports"
  on public.imports for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
