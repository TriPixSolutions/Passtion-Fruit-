create table public.operations_alert_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric text not null check (metric in ('dead_jobs','retry_jobs','failed_webhooks','stale_outbox','unknown_messages')),
  name text not null,
  severity text not null default 'warning' check (severity in ('warning','critical')),
  threshold integer not null check (threshold between 1 and 1000000),
  window_minutes integer not null default 1440 check (window_minutes between 5 and 43200),
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, metric)
);

create table public.operations_incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rule_id uuid references public.operations_alert_rules(id) on delete set null,
  metric text not null check (metric in ('dead_jobs','retry_jobs','failed_webhooks','stale_outbox','unknown_messages')),
  severity text not null check (severity in ('warning','critical')),
  observed_value integer not null check (observed_value >= 0),
  threshold integer not null check (threshold >= 1),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  summary text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index operations_incidents_active_metric_idx on public.operations_incidents(tenant_id, metric) where status in ('open','acknowledged');
create index operations_incidents_tenant_seen_idx on public.operations_incidents(tenant_id, last_seen_at desc);

alter table public.operations_alert_rules enable row level security;
alter table public.operations_incidents enable row level security;
create policy operations_rules_member_read on public.operations_alert_rules for select to authenticated using (public.is_tenant_member(tenant_id));
create policy operations_rules_manager_insert on public.operations_alert_rules for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy operations_rules_manager_update on public.operations_alert_rules for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager'])) with check (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy operations_rules_manager_delete on public.operations_alert_rules for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy operations_incidents_member_read on public.operations_incidents for select to authenticated using (public.is_tenant_member(tenant_id));
create policy operations_incidents_manager_update on public.operations_incidents for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager'])) with check (public.has_tenant_role(tenant_id, array['owner','manager']));
create trigger operations_alert_rules_touch before update on public.operations_alert_rules for each row execute function public.touch_updated_at();
create trigger operations_incidents_touch before update on public.operations_incidents for each row execute function public.touch_updated_at();

insert into public.operations_alert_rules(tenant_id, metric, name, severity, threshold, window_minutes)
select tenant.id, rule.metric, rule.name, rule.severity, rule.threshold, rule.window_minutes from public.tenants tenant
cross join (values
  ('dead_jobs', 'Dead queue jobs', 'critical', 1, 1440), ('retry_jobs', 'Repeated queue retries', 'warning', 5, 60),
  ('failed_webhooks', 'Failed webhook receipts', 'critical', 1, 60), ('stale_outbox', 'Unpublished outbox events', 'critical', 1, 60),
  ('unknown_messages', 'Ambiguous outbound messages', 'warning', 1, 1440)
) as rule(metric, name, severity, threshold, window_minutes) on conflict (tenant_id, metric) do nothing;

create or replace function public.seed_operations_alert_rules() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.operations_alert_rules(tenant_id, metric, name, severity, threshold, window_minutes) values
    (new.id, 'dead_jobs', 'Dead queue jobs', 'critical', 1, 1440), (new.id, 'retry_jobs', 'Repeated queue retries', 'warning', 5, 60),
    (new.id, 'failed_webhooks', 'Failed webhook receipts', 'critical', 1, 60), (new.id, 'stale_outbox', 'Unpublished outbox events', 'critical', 1, 60),
    (new.id, 'unknown_messages', 'Ambiguous outbound messages', 'warning', 1, 1440)
  on conflict (tenant_id, metric) do nothing;
  return new;
end;
$$;
create trigger tenants_seed_operations_rules after insert on public.tenants for each row execute function public.seed_operations_alert_rules();
grant select, insert, update, delete on public.operations_alert_rules to authenticated;
grant select, update on public.operations_incidents to authenticated;
