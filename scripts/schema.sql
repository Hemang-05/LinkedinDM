-- Supabase Database Schema for LinkedInDM
-- Run this in the Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/_/sql)

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

  location text,
  notes text,
  headline text,
  raw_data jsonb,

  unique(user_id, linkedin_url)
);

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

alter table public.profiles enable row level security;
alter table public.connections enable row level security;
alter table public.outreach_events enable row level security;
alter table public.imports enable row level security;

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

-- Automatically create a profile row whenever a new user is created in auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

