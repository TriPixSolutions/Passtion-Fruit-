begin;

alter table public.workflow_runs add column if not exists trigger_message_id uuid references public.messages(id) on delete set null;
create unique index if not exists workflow_runs_trigger_unique
  on public.workflow_runs(workflow_id, workflow_version, trigger_message_id)
  where trigger_message_id is not null;

create or replace function public.enqueue_inbound_workflows(p_message_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_message public.messages%rowtype;
  v_workflow record;
  v_run_id uuid;
  v_job_id uuid;
  v_count integer := 0;
begin
  select * into v_message from public.messages where id = p_message_id and direction = 'inbound';
  if v_message.id is null then return 0; end if;

  for v_workflow in
    select d.id, d.active_version
    from public.workflow_definitions d
    join public.workflow_versions v on v.workflow_id = d.id and v.tenant_id = d.tenant_id and v.version = d.active_version
    where d.tenant_id = v_message.tenant_id
      and d.status = 'active'
      and exists (
        select 1 from jsonb_array_elements(v.graph->'nodes') node
        where node->>'type' = 'trigger' and coalesce(node->'config'->>'event', 'message.received') = 'message.received'
      )
  loop
    v_run_id := null;
    insert into public.workflow_runs(tenant_id, workflow_id, workflow_version, conversation_id, trigger_message_id, status, state)
    values (v_message.tenant_id, v_workflow.id, v_workflow.active_version, v_message.conversation_id, v_message.id, 'running', jsonb_build_object('trigger_message_id', v_message.id))
    on conflict (workflow_id, workflow_version, trigger_message_id) where trigger_message_id is not null do nothing
    returning id into v_run_id;
    if v_run_id is null then continue; end if;
    insert into public.jobs(tenant_id, kind, payload)
    values (v_message.tenant_id, 'workflow', jsonb_build_object('run_id', v_run_id)) returning id into v_job_id;
    insert into public.outbox(tenant_id, topic, payload)
    values (v_message.tenant_id, 'job.workflow', jsonb_build_object('job_id', v_job_id, 'kind', 'workflow'));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.dispatch_due_campaigns(p_limit integer default 25)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_job_id uuid;
  v_eligible integer;
  v_count integer := 0;
begin
  for v_campaign in
    select * from public.campaigns
    where status = 'scheduled' and scheduled_at <= now()
    order by scheduled_at for update skip locked
    limit greatest(1, least(p_limit, 100))
  loop
    insert into public.campaign_recipients(campaign_id, tenant_id, contact_id)
    select v_campaign.id, v_campaign.tenant_id, c.id
    from public.contacts c
    where c.tenant_id = v_campaign.tenant_id and c.consent_status = 'opted_in'
    order by c.created_at
    limit 1000
    on conflict do nothing;
    select count(*) into v_eligible from public.campaign_recipients where campaign_id = v_campaign.id and status = 'pending';
    if v_eligible = 0 then
      update public.campaigns set status = 'cancelled', updated_at = now() where id = v_campaign.id;
      continue;
    end if;
    update public.campaigns set status = 'running', updated_at = now() where id = v_campaign.id;
    insert into public.jobs(tenant_id, kind, payload)
    values (v_campaign.tenant_id, 'campaign', jsonb_build_object('campaign_id', v_campaign.id)) returning id into v_job_id;
    insert into public.outbox(tenant_id, topic, payload)
    values (v_campaign.tenant_id, 'job.campaign', jsonb_build_object('job_id', v_job_id, 'kind', 'campaign'));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.enqueue_inbound_workflows(uuid) from public, anon, authenticated;
revoke all on function public.dispatch_due_campaigns(integer) from public, anon, authenticated;
grant execute on function public.enqueue_inbound_workflows(uuid) to service_role;
grant execute on function public.dispatch_due_campaigns(integer) to service_role;

commit;
