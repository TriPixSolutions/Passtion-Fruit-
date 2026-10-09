create table public.worker_runs (
  id uuid primary key default gen_random_uuid(),
  request_id text not null check (char_length(request_id) between 1 and 128),
  status text not null default 'running' check (status in ('running','succeeded','failed')),
  claimed integer not null default 0 check (claimed >= 0),
  completed integer not null default 0 check (completed >= 0),
  failed integer not null default 0 check (failed >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_category text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index worker_runs_started_idx on public.worker_runs(started_at desc);
alter table public.worker_runs enable row level security;
revoke all on table public.worker_runs from public, anon, authenticated;
grant select, insert, update on table public.worker_runs to service_role;
