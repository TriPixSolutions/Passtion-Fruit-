begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug citext not null unique check (slug::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'active' check (status in ('provisioning', 'active', 'suspended', 'closed')),
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, slug)
);

create table public.memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'agent', 'analyst')),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  auth_revision integer not null default 1 check (auth_revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index memberships_user_active_idx on public.memberships(user_id, tenant_id) where status = 'active';

create table public.feature_definitions (
  key text primary key,
  name text not null,
  description text not null,
  default_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tenant_features (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feature_key text not null references public.feature_definitions(key) on delete restrict,
  enabled boolean not null default false,
  limits jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('user', 'worker', 'platform_support', 'system')),
  action text not null,
  target_type text not null,
  target_id text,
  correlation_id uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_tenant_created_idx on public.audit_events(tenant_id, created_at desc);

insert into public.feature_definitions(key, name, description, default_enabled) values
  ('shared_inbox', 'Shared inbox', 'Team conversation workspace', true),
  ('manual_messages', 'Manual messages', 'One-to-one operator replies', true),
  ('contacts', 'Contacts', 'Contact profiles, consent and tags', true),
  ('campaigns', 'Campaigns', 'Template broadcasts and audience snapshots', false),
  ('schedules', 'Schedules', 'Durable scheduled messages and reminders', false),
  ('workflows', 'Workflows', 'No-code automation graph and runs', false),
  ('ai_assist', 'AI assist', 'Suggested replies for human review', false),
  ('ai_auto_reply', 'AI auto-reply', 'Policy-bound automatic replies', false),
  ('analytics', 'Analytics', 'Operational and messaging reports', false),
  ('commerce', 'Commerce', 'Catalog and order integrations', false)
on conflict (key) do nothing;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.has_tenant_role(p_tenant_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.memberships
    where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active' and role = any(p_roles)
  );
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.has_tenant_role(uuid, text[]) from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated;

create or replace function public.feature_enabled(p_tenant_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(select 1 from public.tenant_features where tenant_id = p_tenant_id and feature_key = p_feature_key and enabled);
$$;

revoke all on function public.feature_enabled(uuid, text) from public;
grant execute on function public.feature_enabled(uuid, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.feature_definitions enable row level security;
alter table public.tenant_features enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy platform_admins_self_select on public.platform_admins for select to authenticated using (user_id = auth.uid());
create policy tenants_member_select on public.tenants for select to authenticated using (public.is_tenant_member(id) or public.is_platform_admin());
create policy memberships_tenant_select on public.memberships for select to authenticated using (public.is_tenant_member(tenant_id) or public.is_platform_admin());
create policy feature_definitions_read on public.feature_definitions for select to authenticated using (true);
create policy tenant_features_member_read on public.tenant_features for select to authenticated using (public.is_tenant_member(tenant_id) or public.is_platform_admin());
create policy audit_events_manager_read on public.audit_events for select to authenticated using (
  tenant_id is not null and (public.has_tenant_role(tenant_id, array['owner','manager']) or public.is_platform_admin())
);

create or replace function public.provision_tenant(
  p_name text,
  p_slug text,
  p_owner_user_id uuid,
  p_feature_keys text[] default array['shared_inbox','manual_messages','contacts']
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  if not exists(select 1 from auth.users where id = p_owner_user_id) then
    raise exception 'owner_user_missing' using errcode = 'P0001';
  end if;

  insert into public.tenants(name, slug, status)
  values (trim(p_name), lower(trim(p_slug)), 'active')
  returning id into v_tenant_id;

  insert into public.memberships(tenant_id, user_id, role, status)
  values (v_tenant_id, p_owner_user_id, 'owner', 'invited');

  insert into public.tenant_features(tenant_id, feature_key, enabled)
  select v_tenant_id, fd.key, fd.default_enabled or fd.key = any(p_feature_keys)
  from public.feature_definitions fd;

  insert into public.audit_events(tenant_id, actor_id, actor_type, action, target_type, target_id)
  values (v_tenant_id, auth.uid(), 'system', 'tenant.provisioned', 'tenant', v_tenant_id::text);

  return v_tenant_id;
end;
$$;

revoke all on function public.provision_tenant(text, text, uuid, text[]) from public, anon, authenticated;
grant execute on function public.provision_tenant(text, text, uuid, text[]) to service_role;

commit;
