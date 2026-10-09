begin;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  capacity integer not null default 10 check (capacity between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, name)
);

create table public.team_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  team_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id),
  foreign key (team_id, tenant_id) references public.teams(id, tenant_id) on delete cascade,
  foreign key (tenant_id, user_id) references public.memberships(tenant_id, user_id) on delete cascade
);

alter table public.conversations add column team_id uuid;
alter table public.conversations add constraint conversations_team_fk foreign key (team_id, tenant_id) references public.teams(id, tenant_id) on delete set null;
alter table public.conversations drop constraint conversations_status_check;
alter table public.conversations add constraint conversations_status_check check (status in ('new', 'open', 'pending', 'waiting_customer', 'waiting_internal', 'escalated', 'resolved', 'blocked', 'spam'));

create table public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, tenant_id) references public.conversations(id, tenant_id) on delete cascade
);

create index conversation_notes_thread_idx on public.conversation_notes(tenant_id, conversation_id, created_at desc);
create index conversations_assignment_idx on public.conversations(tenant_id, assigned_user_id, status, last_message_at desc);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.conversation_notes enable row level security;

create policy teams_member_read on public.teams for select to authenticated using (public.is_tenant_member(tenant_id));
create policy teams_manager_write on public.teams for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager'])) with check (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy team_members_member_read on public.team_members for select to authenticated using (public.is_tenant_member(tenant_id));
create policy team_members_manager_write on public.team_members for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager'])) with check (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy notes_member_read on public.conversation_notes for select to authenticated using (public.is_tenant_member(tenant_id));
create policy notes_member_insert on public.conversation_notes for insert to authenticated with check (public.is_tenant_member(tenant_id) and author_id = auth.uid());

grant select on public.teams, public.team_members, public.conversation_notes to authenticated;
grant insert on public.conversation_notes to authenticated;
grant insert, update, delete on public.teams, public.team_members to authenticated;

commit;
