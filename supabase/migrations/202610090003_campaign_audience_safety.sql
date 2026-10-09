begin;

create table public.contact_suppressions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid not null,
  reason text not null check (reason in ('customer_request','compliance','invalid_number','spam_complaint','manual')),
  source text not null check (char_length(trim(source)) between 2 and 120),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  foreign key (contact_id, tenant_id) references public.contacts(id, tenant_id) on delete cascade
);

create unique index contact_suppressions_active_idx on public.contact_suppressions(tenant_id, contact_id) where active;
alter table public.contact_suppressions enable row level security;
create policy suppressions_member_read on public.contact_suppressions for select to authenticated using (public.is_tenant_member(tenant_id));
create policy suppressions_manager_write on public.contact_suppressions for all to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager'])) with check (public.has_tenant_role(tenant_id, array['owner','manager']));
grant select, insert, update on public.contact_suppressions to authenticated;

alter table public.campaigns
  add column audience_snapshot_at timestamptz,
  add column eligible_count integer not null default 0 check (eligible_count >= 0),
  add column excluded_count integer not null default 0 check (excluded_count >= 0);

create or replace function public.contact_matches_audience(p_contact_id uuid, p_tenant_id uuid, p_filter jsonb)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.contacts c
    where c.id = p_contact_id and c.tenant_id = p_tenant_id
      and c.consent_status = 'opted_in'
      and not exists (
        select 1 from public.contact_suppressions s
        where s.tenant_id = c.tenant_id and s.contact_id = c.id and s.active
      )
      and (
        not (coalesce(p_filter, '{}'::jsonb) ? 'lifecycleStages')
        or jsonb_array_length(coalesce(p_filter->'lifecycleStages','[]'::jsonb)) = 0
        or c.lifecycle_stage in (select jsonb_array_elements_text(p_filter->'lifecycleStages'))
      )
      and (
        not (coalesce(p_filter, '{}'::jsonb) ? 'minLeadScore')
        or c.lead_score >= greatest(0, least(100, (p_filter->>'minLeadScore')::integer))
      )
      and (
        nullif(trim(coalesce(p_filter->>'source','')), '') is null
        or lower(coalesce(c.source,'')) = lower(p_filter->>'source')
      )
      and (
        not (coalesce(p_filter, '{}'::jsonb) ? 'tagIds')
        or jsonb_array_length(coalesce(p_filter->'tagIds','[]'::jsonb)) = 0
        or exists (
          select 1 from public.contact_tags ct
          where ct.tenant_id = c.tenant_id and ct.contact_id = c.id
            and ct.tag_id::text in (select jsonb_array_elements_text(p_filter->'tagIds'))
        )
      )
  );
$$;

revoke all on function public.contact_matches_audience(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.contact_matches_audience(uuid, uuid, jsonb) to service_role;

create or replace function public.preview_campaign_audience(p_campaign_id uuid)
returns table(eligible integer, opted_out integer, suppressed integer, filter_mismatch integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_campaign public.campaigns%rowtype;
begin
  select * into v_campaign from public.campaigns where id = p_campaign_id;
  if v_campaign.id is null then raise exception 'campaign_not_found' using errcode = 'P0002'; end if;
  if not public.is_tenant_member(v_campaign.tenant_id) then raise exception 'tenant_access_denied' using errcode = '42501'; end if;
  return query
  select
    count(*) filter (where public.contact_matches_audience(c.id,c.tenant_id,v_campaign.audience_filter))::integer,
    count(*) filter (where c.consent_status <> 'opted_in')::integer,
    count(*) filter (where c.consent_status = 'opted_in' and exists(select 1 from public.contact_suppressions s where s.tenant_id=c.tenant_id and s.contact_id=c.id and s.active))::integer,
    count(*) filter (where c.consent_status = 'opted_in' and not exists(select 1 from public.contact_suppressions s where s.tenant_id=c.tenant_id and s.contact_id=c.id and s.active) and not public.contact_matches_audience(c.id,c.tenant_id,v_campaign.audience_filter))::integer
  from public.contacts c where c.tenant_id = v_campaign.tenant_id;
end;
$$;

revoke all on function public.preview_campaign_audience(uuid) from public, anon;
grant execute on function public.preview_campaign_audience(uuid) to authenticated;

create or replace function public.launch_campaign(p_campaign_id uuid, p_max_recipients integer default 100)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_campaign public.campaigns%rowtype; v_count integer; v_excluded integer; v_job_id uuid;
begin
  select * into v_campaign from public.campaigns where id=p_campaign_id for update;
  if v_campaign.id is null then raise exception 'campaign_not_found' using errcode='P0002'; end if;
  if not public.has_tenant_role(v_campaign.tenant_id,array['owner','manager']) then raise exception 'tenant_access_denied' using errcode='42501'; end if;
  if not public.feature_enabled(v_campaign.tenant_id,'campaigns') then raise exception 'feature_disabled' using errcode='42501'; end if;
  if v_campaign.status not in ('draft','paused') then raise exception 'campaign_not_launchable' using errcode='22023'; end if;
  insert into public.campaign_recipients(campaign_id,tenant_id,contact_id)
  select v_campaign.id,v_campaign.tenant_id,c.id from public.contacts c
  where c.tenant_id=v_campaign.tenant_id and public.contact_matches_audience(c.id,c.tenant_id,v_campaign.audience_filter)
  order by c.created_at limit greatest(1,least(p_max_recipients,1000)) on conflict do nothing;
  select count(*) into v_count from public.campaign_recipients where campaign_id=v_campaign.id and status='pending';
  select count(*)-v_count into v_excluded from public.contacts where tenant_id=v_campaign.tenant_id;
  if v_count=0 then raise exception 'campaign_has_no_eligible_recipients' using errcode='P0002'; end if;
  update public.campaigns set status='running',audience_snapshot_at=now(),eligible_count=v_count,excluded_count=greatest(v_excluded,0),updated_at=now() where id=v_campaign.id;
  insert into public.jobs(tenant_id,kind,payload) values(v_campaign.tenant_id,'campaign',jsonb_build_object('campaign_id',v_campaign.id)) returning id into v_job_id;
  insert into public.outbox(tenant_id,topic,payload) values(v_campaign.tenant_id,'job.campaign',jsonb_build_object('job_id',v_job_id,'kind','campaign'));
  return v_count;
end; $$;

revoke all on function public.launch_campaign(uuid, integer) from public, anon;
grant execute on function public.launch_campaign(uuid, integer) to authenticated;

create or replace function public.expand_campaign_batch(p_campaign_id uuid,p_limit integer default 25)
returns table(enqueued integer,remaining integer) language plpgsql security definer set search_path=public,pg_temp as $$
declare v_campaign public.campaigns%rowtype;v_recipient public.campaign_recipients%rowtype;v_conversation_id uuid;v_message_id uuid;v_job_id uuid;v_next_job_id uuid;v_count integer:=0;v_remaining integer;
begin
  select * into v_campaign from public.campaigns where id=p_campaign_id for update;
  if v_campaign.id is null then raise exception 'campaign_not_found'; end if;
  if v_campaign.status<>'running' then return query select 0,0;return;end if;
  for v_recipient in select * from public.campaign_recipients where campaign_id=p_campaign_id and status='pending' order by created_at for update skip locked limit greatest(1,least(p_limit,100)) loop
    if not public.contact_matches_audience(v_recipient.contact_id,v_campaign.tenant_id,v_campaign.audience_filter) then
      update public.campaign_recipients set status='skipped' where campaign_id=p_campaign_id and contact_id=v_recipient.contact_id;continue;
    end if;
    insert into public.conversations(tenant_id,channel_id,contact_id) values(v_campaign.tenant_id,v_campaign.channel_id,v_recipient.contact_id) on conflict(tenant_id,channel_id,contact_id) do update set updated_at=now() returning id into v_conversation_id;
    insert into public.messages(tenant_id,conversation_id,channel_id,contact_id,direction,origin,status,idempotency_key,content,expires_at) values(v_campaign.tenant_id,v_conversation_id,v_campaign.channel_id,v_recipient.contact_id,'outbound','campaign','queued','campaign:'||v_campaign.id||':'||v_recipient.contact_id,v_campaign.template,now()+interval '24 hours') on conflict(tenant_id,idempotency_key) where idempotency_key is not null do update set updated_at=public.messages.updated_at returning id into v_message_id;
    if not exists(select 1 from public.jobs where kind='outbound' and payload->>'message_id'=v_message_id::text and status<>'dead') then insert into public.jobs(tenant_id,kind,payload) values(v_campaign.tenant_id,'outbound',jsonb_build_object('message_id',v_message_id)) returning id into v_job_id;insert into public.outbox(tenant_id,topic,payload) values(v_campaign.tenant_id,'job.outbound',jsonb_build_object('job_id',v_job_id,'kind','outbound'));end if;
    update public.campaign_recipients set status='queued',message_id=v_message_id where campaign_id=p_campaign_id and contact_id=v_recipient.contact_id;v_count:=v_count+1;
  end loop;
  select count(*) into v_remaining from public.campaign_recipients where campaign_id=p_campaign_id and status='pending';
  if v_remaining>0 then insert into public.jobs(tenant_id,kind,payload) values(v_campaign.tenant_id,'campaign',jsonb_build_object('campaign_id',v_campaign.id)) returning id into v_next_job_id;insert into public.outbox(tenant_id,topic,payload) values(v_campaign.tenant_id,'job.campaign',jsonb_build_object('job_id',v_next_job_id,'kind','campaign'));else update public.campaigns set expanded_at=now(),updated_at=now() where id=p_campaign_id;end if;
  return query select v_count,v_remaining;
end; $$;

revoke all on function public.expand_campaign_batch(uuid, integer) from public, anon, authenticated;
grant execute on function public.expand_campaign_batch(uuid, integer) to service_role;

create or replace function public.dispatch_due_campaigns(p_limit integer default 25)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_campaign public.campaigns%rowtype;v_job_id uuid;v_eligible integer;v_excluded integer;v_count integer:=0;
begin
  for v_campaign in select * from public.campaigns where status='scheduled' and scheduled_at<=now() order by scheduled_at for update skip locked limit greatest(1,least(p_limit,100)) loop
    insert into public.campaign_recipients(campaign_id,tenant_id,contact_id) select v_campaign.id,v_campaign.tenant_id,c.id from public.contacts c where c.tenant_id=v_campaign.tenant_id and public.contact_matches_audience(c.id,c.tenant_id,v_campaign.audience_filter) order by c.created_at limit 1000 on conflict do nothing;
    select count(*) into v_eligible from public.campaign_recipients where campaign_id=v_campaign.id and status='pending';
    select count(*)-v_eligible into v_excluded from public.contacts where tenant_id=v_campaign.tenant_id;
    if v_eligible=0 then update public.campaigns set status='cancelled',audience_snapshot_at=now(),eligible_count=0,excluded_count=greatest(v_excluded,0),updated_at=now() where id=v_campaign.id;continue;end if;
    update public.campaigns set status='running',audience_snapshot_at=now(),eligible_count=v_eligible,excluded_count=greatest(v_excluded,0),updated_at=now() where id=v_campaign.id;
    insert into public.jobs(tenant_id,kind,payload) values(v_campaign.tenant_id,'campaign',jsonb_build_object('campaign_id',v_campaign.id)) returning id into v_job_id;insert into public.outbox(tenant_id,topic,payload) values(v_campaign.tenant_id,'job.campaign',jsonb_build_object('job_id',v_job_id,'kind','campaign'));v_count:=v_count+1;
  end loop;return v_count;
end; $$;

revoke all on function public.dispatch_due_campaigns(integer) from public, anon, authenticated;
grant execute on function public.dispatch_due_campaigns(integer) to service_role;

commit;
