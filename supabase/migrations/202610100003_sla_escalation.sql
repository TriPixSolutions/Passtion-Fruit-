begin;

alter table public.sla_policies add constraint sla_policies_id_tenant_unique unique (id, tenant_id);

create table public.conversation_sla_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null,
  policy_id uuid not null,
  inbound_message_id uuid not null,
  kind text not null default 'first_response' check (kind = 'first_response'),
  due_at timestamptz not null,
  breached_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conversation_id, inbound_message_id, kind),
  foreign key (conversation_id, tenant_id) references public.conversations(id, tenant_id) on delete cascade,
  foreign key (policy_id, tenant_id) references public.sla_policies(id, tenant_id) on delete cascade,
  foreign key (inbound_message_id, tenant_id) references public.messages(id, tenant_id) on delete cascade
);

create index conversation_sla_events_active_idx on public.conversation_sla_events(tenant_id, breached_at desc) where resolved_at is null;
alter table public.conversation_sla_events enable row level security;
create policy conversation_sla_events_member_read on public.conversation_sla_events for select to authenticated using (public.is_tenant_member(tenant_id));
grant select on public.conversation_sla_events to authenticated;

alter table public.operations_alert_rules drop constraint operations_alert_rules_metric_check;
alter table public.operations_alert_rules add constraint operations_alert_rules_metric_check check (metric in ('dead_jobs','retry_jobs','failed_webhooks','stale_outbox','unknown_messages','sla_breaches'));
alter table public.operations_incidents drop constraint operations_incidents_metric_check;
alter table public.operations_incidents add constraint operations_incidents_metric_check check (metric in ('dead_jobs','retry_jobs','failed_webhooks','stale_outbox','unknown_messages','sla_breaches'));

insert into public.operations_alert_rules(tenant_id,metric,name,severity,threshold,window_minutes)
select id,'sla_breaches','Overdue first responses','warning',1,1440 from public.tenants
on conflict (tenant_id,metric) do nothing;

create or replace function public.seed_operations_alert_rules() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.operations_alert_rules(tenant_id, metric, name, severity, threshold, window_minutes) values
    (new.id, 'dead_jobs', 'Dead queue jobs', 'critical', 1, 1440), (new.id, 'retry_jobs', 'Repeated queue retries', 'warning', 5, 60),
    (new.id, 'failed_webhooks', 'Failed webhook receipts', 'critical', 1, 60), (new.id, 'stale_outbox', 'Unpublished outbox events', 'critical', 1, 60),
    (new.id, 'unknown_messages', 'Ambiguous outbound messages', 'warning', 1, 1440), (new.id, 'sla_breaches', 'Overdue first responses', 'warning', 1, 1440)
  on conflict (tenant_id, metric) do nothing;
  return new;
end;
$$;

create or replace function public.evaluate_sla_breaches() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  candidate record;
  tenant_row record;
  active_count integer;
  total_new integer := 0;
  active_incident uuid;
begin
  for candidate in
    select c.id conversation_id,c.tenant_id,p.id policy_id,m.id inbound_message_id,
      m.created_at + make_interval(mins => p.first_response_minutes) due_at
    from public.conversations c
    join public.sla_policies p on p.tenant_id=c.tenant_id and p.active and p.is_default
    join lateral (
      select id,created_at from public.messages
      where tenant_id=c.tenant_id and conversation_id=c.id and direction='inbound'
      order by created_at desc limit 1
    ) m on true
    where c.status not in ('resolved','blocked','spam')
      and m.created_at + make_interval(mins => p.first_response_minutes) <= now()
      and not exists (
        select 1 from public.messages reply
        where reply.tenant_id=c.tenant_id and reply.conversation_id=c.id and reply.direction='outbound' and reply.created_at>m.created_at
      )
  loop
    insert into public.conversation_sla_events(tenant_id,conversation_id,policy_id,inbound_message_id,due_at)
    values(candidate.tenant_id,candidate.conversation_id,candidate.policy_id,candidate.inbound_message_id,candidate.due_at)
    on conflict (conversation_id,inbound_message_id,kind) do nothing;
    if found then total_new:=total_new+1; end if;
    update public.conversations set status='escalated',updated_at=now()
    where id=candidate.conversation_id and tenant_id=candidate.tenant_id and status not in ('escalated','resolved','blocked','spam');
  end loop;

  update public.conversation_sla_events event set resolved_at=now()
  where event.resolved_at is null and (
    exists(select 1 from public.messages reply where reply.tenant_id=event.tenant_id and reply.conversation_id=event.conversation_id and reply.direction='outbound' and reply.created_at>(select created_at from public.messages where id=event.inbound_message_id))
    or exists(select 1 from public.conversations c where c.id=event.conversation_id and c.status in ('resolved','blocked','spam'))
  );

  for tenant_row in
    select tenant.id,rule.threshold,rule.severity,rule.enabled
    from public.tenants tenant
    join public.operations_alert_rules rule on rule.tenant_id=tenant.id and rule.metric='sla_breaches'
    where tenant.status='active'
  loop
    select count(*) into active_count from public.conversation_sla_events where tenant_id=tenant_row.id and resolved_at is null;
    select id into active_incident from public.operations_incidents where tenant_id=tenant_row.id and metric='sla_breaches' and status in ('open','acknowledged') limit 1;
    if tenant_row.enabled and active_count>=tenant_row.threshold then
      if active_incident is null then
        insert into public.operations_incidents(tenant_id,metric,severity,observed_value,threshold,status,summary)
        values(tenant_row.id,'sla_breaches',tenant_row.severity,active_count,tenant_row.threshold,'open','Customer conversations exceeded the configured first-response SLA');
      else
        update public.operations_incidents set severity=tenant_row.severity,observed_value=active_count,threshold=tenant_row.threshold,last_seen_at=now(),summary='Customer conversations exceeded the configured first-response SLA' where id=active_incident;
      end if;
    elsif active_incident is not null then
      update public.operations_incidents set status='resolved',observed_value=0,last_seen_at=now(),resolved_at=now() where id=active_incident;
    end if;
    active_incident:=null;
  end loop;
  return total_new;
end;
$$;

revoke all on function public.evaluate_sla_breaches() from public,anon,authenticated;
grant execute on function public.evaluate_sla_breaches() to service_role;

commit;
