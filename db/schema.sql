-- Lookout portfolio schema for a Postgres-backed version of the demo.
-- This is intentionally small: it models the core data boundaries the
-- frontend currently simulates in localStorage.

create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists family_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  age integer not null check (age between 0 and 120),
  gender text not null check (gender in ('female', 'male', 'other')),
  height_cm integer check (height_cm between 30 and 250),
  marks text,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  case_id text not null unique,
  user_id uuid not null references app_users(id) on delete cascade,
  member_id uuid not null references family_members(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'resolved')),
  description jsonb not null,
  last_seen jsonb not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists sightings (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  finder_key text,
  source text not null check (
    source in ('qr-scan', 'manual-match', 'found-report', 'police-handoff')
  ),
  lat double precision not null,
  lng double precision not null,
  label text,
  note text,
  with_police boolean not null default false,
  station_id text,
  created_at timestamptz not null default now()
);

create table if not exists gate_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists found_reports (
  id uuid primary key default gen_random_uuid(),
  description jsonb not null,
  location jsonb not null,
  where_safe text not null,
  status text not null default 'open' check (status in ('open', 'linked', 'closed')),
  linked_report_id uuid references reports(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  recipient_user_id uuid references app_users(id) on delete cascade,
  audience text not null check (audience in ('family', 'nearby')),
  kind text check (kind in ('confirmed', 'possible')),
  finder_key text,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_members_user_id on family_members(user_id);
create index if not exists idx_reports_user_id on reports(user_id);
create index if not exists idx_reports_member_status on reports(member_id, status);
create index if not exists idx_reports_status_created on reports(status, created_at desc);
create unique index if not exists idx_one_active_report_per_member
  on reports(member_id)
  where status = 'active';
create index if not exists idx_sightings_report_created on sightings(report_id, created_at desc);
create index if not exists idx_found_reports_status_created on found_reports(status, created_at desc);
create index if not exists idx_notifications_recipient_read
  on notifications(recipient_user_id, read, created_at desc);
