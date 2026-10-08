begin;

create table public.worker_trigger_secrets (
  id smallint primary key default 1 check (id = 1),
  secret_sha256 text not null check (secret_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);

alter table public.worker_trigger_secrets enable row level security;
revoke all on table public.worker_trigger_secrets from public, anon, authenticated;
grant select, insert, update on table public.worker_trigger_secrets to service_role;

commit;
