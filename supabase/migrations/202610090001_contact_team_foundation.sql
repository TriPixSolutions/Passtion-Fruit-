begin;

alter table public.contacts
  add column lifecycle_stage text not null default 'lead'
    check (lifecycle_stage in ('lead','qualified','opportunity','customer','repeat_customer','win_back','inactive')),
  add column lead_score integer not null default 0 check (lead_score between 0 and 100),
  add column source text,
  add column consent_updated_at timestamptz,
  add column consent_source text,
  add column assigned_user_id uuid references auth.users(id) on delete set null,
  add column team_id uuid;

alter table public.contacts
  add constraint contacts_assignee_fk foreign key (tenant_id, assigned_user_id)
    references public.memberships(tenant_id, user_id) on delete set null,
  add constraint contacts_team_fk foreign key (team_id, tenant_id)
    references public.teams(id, tenant_id) on delete set null;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  color text not null default 'sage' check (color in ('sage','blue','amber','violet','rose','slate')),
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, name)
);

create table public.contact_tags (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id),
  foreign key (contact_id, tenant_id) references public.contacts(id, tenant_id) on delete cascade,
  foreign key (tag_id, tenant_id) references public.tags(id, tenant_id) on delete cascade
);

create table public.saved_replies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shortcut text not null check (shortcut ~ '^/[a-z0-9_-]{2,30}$'),
  title text not null check (char_length(trim(title)) between 2 and 80),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, shortcut)
);

create table public.sla_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  first_response_minutes integer not null default 15 check (first_response_minutes between 1 and 10080),
  resolution_minutes integer not null default 1440 check (resolution_minutes between 1 and 43200),
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create unique index sla_policies_one_default_idx on public.sla_policies(tenant_id) where is_default;
create index contacts_segment_idx on public.contacts(tenant_id, lifecycle_stage, lead_score desc, updated_at desc);
create index contact_tags_tenant_idx on public.contact_tags(tenant_id, tag_id, contact_id);

alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.saved_replies enable row level security;
alter table public.sla_policies enable row level security;

create policy tags_member_read on public.tags for select to authenticated using (public.is_tenant_member(tenant_id));
create policy tags_manager_write on public.tags for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager'])) with check (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy contact_tags_member_read on public.contact_tags for select to authenticated using (public.is_tenant_member(tenant_id));
create policy contact_tags_member_write on public.contact_tags for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager','agent'])) with check (public.has_tenant_role(tenant_id, array['owner','manager','agent']));
create policy saved_replies_member_read on public.saved_replies for select to authenticated using (public.is_tenant_member(tenant_id));
create policy saved_replies_manager_write on public.saved_replies for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager'])) with check (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy sla_member_read on public.sla_policies for select to authenticated using (public.is_tenant_member(tenant_id));
create policy sla_manager_write on public.sla_policies for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager'])) with check (public.has_tenant_role(tenant_id, array['owner','manager']));

grant select on public.tags, public.contact_tags, public.saved_replies, public.sla_policies to authenticated;
grant insert, update, delete on public.tags, public.contact_tags, public.saved_replies, public.sla_policies to authenticated;

commit;
