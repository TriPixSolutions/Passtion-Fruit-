begin;

create table public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel_id uuid not null,
  contact_id uuid not null,
  conversation_id uuid,
  content jsonb not null,
  origin text not null default 'reminder' check (origin in ('reminder', 'workflow', 'campaign')),
  due_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'enqueued', 'cancelled', 'expired')),
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  foreign key (channel_id, tenant_id) references public.channels(id, tenant_id) on delete restrict,
  foreign key (contact_id, tenant_id) references public.contacts(id, tenant_id) on delete restrict,
  foreign key (conversation_id, tenant_id) references public.conversations(id, tenant_id) on delete cascade
);

create index scheduled_messages_due_idx on public.scheduled_messages(due_at) where status = 'scheduled';

create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  purpose text not null,
  mode text not null default 'suggest' check (mode in ('disabled', 'suggest', 'auto_reply')),
  instructions text not null default '',
  allowed_tools text[] not null default '{}',
  daily_budget_minor integer not null default 0 check (daily_budget_minor >= 0),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  active_version integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.workflow_versions (
  workflow_id uuid not null,
  tenant_id uuid not null,
  version integer not null check (version > 0),
  graph jsonb not null,
  checksum text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (workflow_id, version),
  unique (workflow_id, version, tenant_id),
  foreign key (workflow_id, tenant_id) references public.workflow_definitions(id, tenant_id) on delete cascade
);

create table public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workflow_id uuid not null,
  workflow_version integer not null,
  conversation_id uuid,
  status text not null default 'running' check (status in ('running', 'waiting', 'completed', 'failed', 'cancelled')),
  current_node_id text,
  state jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (workflow_id, workflow_version, tenant_id) references public.workflow_versions(workflow_id, version, tenant_id) on delete restrict,
  foreign key (conversation_id, tenant_id) references public.conversations(id, tenant_id) on delete set null
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
  channel_id uuid not null,
  template jsonb not null,
  audience_filter jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  expanded_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (channel_id, tenant_id) references public.channels(id, tenant_id) on delete restrict
);

create table public.campaign_recipients (
  campaign_id uuid not null,
  tenant_id uuid not null,
  contact_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'queued', 'accepted', 'delivered', 'read', 'failed', 'skipped')),
  message_id uuid,
  created_at timestamptz not null default now(),
  primary key (campaign_id, contact_id),
  foreign key (campaign_id, tenant_id) references public.campaigns(id, tenant_id) on delete cascade,
  foreign key (contact_id, tenant_id) references public.contacts(id, tenant_id) on delete cascade,
  foreign key (message_id, tenant_id) references public.messages(id, tenant_id) on delete set null
);

create table public.usage_ledger (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  meter text not null,
  logical_key text not null,
  quantity integer not null check (quantity > 0),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (tenant_id, meter, logical_key)
);

alter table public.scheduled_messages enable row level security;
alter table public.ai_agents enable row level security;
alter table public.workflow_definitions enable row level security;
alter table public.workflow_versions enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.usage_ledger enable row level security;

create policy schedules_member_read on public.scheduled_messages for select to authenticated using (public.is_tenant_member(tenant_id));
create policy schedules_manager_write on public.scheduled_messages for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']) and public.feature_enabled(tenant_id, 'schedules')) with check (public.has_tenant_role(tenant_id, array['owner','manager']) and public.feature_enabled(tenant_id, 'schedules'));
create policy agents_manager_all on public.ai_agents for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']) and (public.feature_enabled(tenant_id, 'ai_assist') or public.feature_enabled(tenant_id, 'ai_auto_reply'))) with check (public.has_tenant_role(tenant_id, array['owner','manager']) and (public.feature_enabled(tenant_id, 'ai_assist') or public.feature_enabled(tenant_id, 'ai_auto_reply')));
create policy workflows_member_read on public.workflow_definitions for select to authenticated using (public.is_tenant_member(tenant_id));
create policy workflows_manager_write on public.workflow_definitions for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']) and public.feature_enabled(tenant_id, 'workflows')) with check (public.has_tenant_role(tenant_id, array['owner','manager']) and public.feature_enabled(tenant_id, 'workflows'));
create policy workflow_versions_member_read on public.workflow_versions for select to authenticated using (public.is_tenant_member(tenant_id));
create policy workflow_versions_manager_write on public.workflow_versions for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']) and public.feature_enabled(tenant_id, 'workflows')) with check (public.has_tenant_role(tenant_id, array['owner','manager']) and public.feature_enabled(tenant_id, 'workflows'));
create policy workflow_runs_member_read on public.workflow_runs for select to authenticated using (public.is_tenant_member(tenant_id));
create policy campaigns_member_read on public.campaigns for select to authenticated using (public.is_tenant_member(tenant_id));
create policy campaigns_manager_write on public.campaigns for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']) and public.feature_enabled(tenant_id, 'campaigns')) with check (public.has_tenant_role(tenant_id, array['owner','manager']) and public.feature_enabled(tenant_id, 'campaigns'));
create policy campaign_recipients_member_read on public.campaign_recipients for select to authenticated using (public.is_tenant_member(tenant_id));
create policy usage_manager_read on public.usage_ledger for select to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']));

create or replace function public.launch_campaign(p_campaign_id uuid, p_max_recipients integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_count integer;
  v_job_id uuid;
begin
  select * into v_campaign from public.campaigns where id = p_campaign_id for update;
  if v_campaign.id is null then raise exception 'campaign_not_found' using errcode = 'P0002'; end if;
  if not public.has_tenant_role(v_campaign.tenant_id, array['owner','manager']) then raise exception 'tenant_access_denied' using errcode = '42501'; end if;
  if not public.feature_enabled(v_campaign.tenant_id, 'campaigns') then raise exception 'feature_disabled' using errcode = '42501'; end if;
  if v_campaign.status not in ('draft', 'paused') then raise exception 'campaign_not_launchable' using errcode = '22023'; end if;
  if v_campaign.audience_filter <> '{}'::jsonb then raise exception 'audience_filter_not_implemented' using errcode = '0A000'; end if;

  insert into public.campaign_recipients(campaign_id, tenant_id, contact_id)
  select v_campaign.id, v_campaign.tenant_id, c.id
  from public.contacts c
  where c.tenant_id = v_campaign.tenant_id and c.consent_status = 'opted_in'
  order by c.created_at
  limit greatest(1, least(p_max_recipients, 1000))
  on conflict do nothing;
  get diagnostics v_count = row_count;
  if not exists(select 1 from public.campaign_recipients where campaign_id = v_campaign.id and status = 'pending') then
    raise exception 'campaign_has_no_eligible_recipients' using errcode = 'P0002';
  end if;

  update public.campaigns set status = 'running', updated_at = now() where id = v_campaign.id;
  insert into public.jobs(tenant_id, kind, payload) values (v_campaign.tenant_id, 'campaign', jsonb_build_object('campaign_id', v_campaign.id)) returning id into v_job_id;
  insert into public.outbox(tenant_id, topic, payload) values (v_campaign.tenant_id, 'job.campaign', jsonb_build_object('job_id', v_job_id, 'kind', 'campaign'));
  return v_count;
end;
$$;

revoke all on function public.launch_campaign(uuid, integer) from public, anon;
grant execute on function public.launch_campaign(uuid, integer) to authenticated;

create or replace function public.expand_campaign_batch(p_campaign_id uuid, p_limit integer default 25)
returns table(enqueued integer, remaining integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_recipient public.campaign_recipients%rowtype;
  v_conversation_id uuid;
  v_message_id uuid;
  v_job_id uuid;
  v_next_job_id uuid;
  v_count integer := 0;
  v_remaining integer;
begin
  select * into v_campaign from public.campaigns where id = p_campaign_id for update;
  if v_campaign.id is null then raise exception 'campaign_not_found'; end if;
  if v_campaign.status <> 'running' then return query select 0, 0; return; end if;

  for v_recipient in
    select * from public.campaign_recipients where campaign_id = p_campaign_id and status = 'pending'
    order by created_at for update skip locked limit greatest(1, least(p_limit, 100))
  loop
    insert into public.conversations(tenant_id, channel_id, contact_id)
    values (v_campaign.tenant_id, v_campaign.channel_id, v_recipient.contact_id)
    on conflict (tenant_id, channel_id, contact_id) do update set updated_at = now()
    returning id into v_conversation_id;

    insert into public.messages(tenant_id, conversation_id, channel_id, contact_id, direction, origin, status, idempotency_key, content, expires_at)
    values (v_campaign.tenant_id, v_conversation_id, v_campaign.channel_id, v_recipient.contact_id, 'outbound', 'campaign', 'queued', 'campaign:' || v_campaign.id || ':' || v_recipient.contact_id, v_campaign.template, now() + interval '24 hours')
    on conflict (tenant_id, idempotency_key) where idempotency_key is not null do update set updated_at = public.messages.updated_at
    returning id into v_message_id;

    if not exists(select 1 from public.jobs where kind = 'outbound' and payload->>'message_id' = v_message_id::text and status <> 'dead') then
      insert into public.jobs(tenant_id, kind, payload) values (v_campaign.tenant_id, 'outbound', jsonb_build_object('message_id', v_message_id)) returning id into v_job_id;
      insert into public.outbox(tenant_id, topic, payload) values (v_campaign.tenant_id, 'job.outbound', jsonb_build_object('job_id', v_job_id, 'kind', 'outbound'));
    end if;
    update public.campaign_recipients set status = 'queued', message_id = v_message_id where campaign_id = p_campaign_id and contact_id = v_recipient.contact_id;
    v_count := v_count + 1;
  end loop;

  select count(*) into v_remaining from public.campaign_recipients where campaign_id = p_campaign_id and status = 'pending';
  if v_remaining > 0 then
    insert into public.jobs(tenant_id, kind, payload) values (v_campaign.tenant_id, 'campaign', jsonb_build_object('campaign_id', v_campaign.id)) returning id into v_next_job_id;
    insert into public.outbox(tenant_id, topic, payload) values (v_campaign.tenant_id, 'job.campaign', jsonb_build_object('job_id', v_next_job_id, 'kind', 'campaign'));
  else
    update public.campaigns set expanded_at = now(), updated_at = now() where id = p_campaign_id;
  end if;
  return query select v_count, v_remaining;
end;
$$;

revoke all on function public.expand_campaign_batch(uuid, integer) from public, anon, authenticated;
grant execute on function public.expand_campaign_batch(uuid, integer) to service_role;

create or replace function public.publish_workflow(p_workflow_id uuid, p_version integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workflow public.workflow_definitions%rowtype;
  v_graph jsonb;
begin
  select * into v_workflow from public.workflow_definitions where id = p_workflow_id for update;
  if v_workflow.id is null then raise exception 'workflow_not_found' using errcode = 'P0002'; end if;
  if not public.has_tenant_role(v_workflow.tenant_id, array['owner','manager']) then raise exception 'tenant_access_denied' using errcode = '42501'; end if;
  if not public.feature_enabled(v_workflow.tenant_id, 'workflows') then raise exception 'feature_disabled' using errcode = '42501'; end if;
  select graph into v_graph from public.workflow_versions where workflow_id = p_workflow_id and version = p_version and tenant_id = v_workflow.tenant_id;
  if v_graph is null then raise exception 'workflow_version_not_found' using errcode = 'P0002'; end if;
  if jsonb_typeof(v_graph->'nodes') <> 'array' or jsonb_array_length(v_graph->'nodes') = 0 then raise exception 'workflow_nodes_invalid' using errcode = '22023'; end if;
  if jsonb_typeof(v_graph->'edges') <> 'array' then raise exception 'workflow_edges_invalid' using errcode = '22023'; end if;
  update public.workflow_versions set published_at = coalesce(published_at, now()) where workflow_id = p_workflow_id and version = p_version;
  update public.workflow_definitions set status = 'active', active_version = p_version, updated_at = now() where id = p_workflow_id;
end;
$$;

revoke all on function public.publish_workflow(uuid, integer) from public, anon;
grant execute on function public.publish_workflow(uuid, integer) to authenticated;

create or replace function public.dispatch_due_schedules(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_schedule public.scheduled_messages%rowtype;
  v_conversation_id uuid;
  v_message_id uuid;
  v_job_id uuid;
  v_count integer := 0;
begin
  for v_schedule in
    select * from public.scheduled_messages
    where status = 'scheduled' and due_at <= now()
    order by due_at
    for update skip locked
    limit greatest(1, least(p_limit, 500))
  loop
    if v_schedule.expires_at <= now() then
      update public.scheduled_messages set status = 'expired', updated_at = now() where id = v_schedule.id;
      continue;
    end if;
    if not exists(select 1 from public.tenant_features where tenant_id = v_schedule.tenant_id and feature_key = 'schedules' and enabled) then
      update public.scheduled_messages set status = 'cancelled', updated_at = now() where id = v_schedule.id;
      continue;
    end if;
    if v_schedule.conversation_id is null then
      insert into public.conversations(tenant_id, channel_id, contact_id)
      values (v_schedule.tenant_id, v_schedule.channel_id, v_schedule.contact_id)
      on conflict (tenant_id, channel_id, contact_id) do update set updated_at = now()
      returning id into v_conversation_id;
    else
      v_conversation_id := v_schedule.conversation_id;
    end if;
    insert into public.messages(tenant_id, conversation_id, channel_id, contact_id, direction, origin, status, idempotency_key, content, expires_at)
    values (v_schedule.tenant_id, v_conversation_id, v_schedule.channel_id, v_schedule.contact_id, 'outbound', v_schedule.origin, 'queued', v_schedule.idempotency_key, v_schedule.content, v_schedule.expires_at)
    on conflict (tenant_id, idempotency_key) where idempotency_key is not null do update set updated_at = public.messages.updated_at
    returning id into v_message_id;
    insert into public.jobs(tenant_id, kind, payload) values (v_schedule.tenant_id, 'outbound', jsonb_build_object('message_id', v_message_id)) returning id into v_job_id;
    insert into public.outbox(tenant_id, topic, payload) values (v_schedule.tenant_id, 'job.outbound', jsonb_build_object('job_id', v_job_id, 'kind', 'outbound'));
    update public.scheduled_messages set status = 'enqueued', updated_at = now() where id = v_schedule.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.dispatch_due_schedules(integer) from public, anon, authenticated;
grant execute on function public.dispatch_due_schedules(integer) to service_role;

commit;
