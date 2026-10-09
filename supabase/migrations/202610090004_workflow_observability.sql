begin;

alter table public.workflow_runs add column attempt integer not null default 1 check (attempt between 1 and 100);

create table public.workflow_run_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  run_id uuid not null references public.workflow_runs(id) on delete cascade,
  node_id text not null,
  node_type text not null check (node_type in ('message','assign','contact','status','note')),
  attempt integer not null default 1 check (attempt between 1 and 100),
  status text not null default 'running' check (status in ('running','completed','failed','skipped')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (run_id, node_id, attempt)
);

create index workflow_run_steps_run_idx on public.workflow_run_steps(tenant_id, run_id, started_at);
alter table public.workflow_run_steps enable row level security;
create policy workflow_steps_member_read on public.workflow_run_steps for select to authenticated using (public.is_tenant_member(tenant_id));
grant select on public.workflow_run_steps to authenticated;

create or replace function public.retry_workflow_run(p_run_id uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_run public.workflow_runs%rowtype;v_job_id uuid;v_attempt integer;
begin
  select * into v_run from public.workflow_runs where id=p_run_id for update;
  if v_run.id is null then raise exception 'workflow_run_not_found' using errcode='P0002';end if;
  if not public.has_tenant_role(v_run.tenant_id,array['owner','manager']) then raise exception 'tenant_access_denied' using errcode='42501';end if;
  if v_run.status<>'failed' then raise exception 'workflow_run_not_retryable' using errcode='22023';end if;
  v_attempt:=v_run.attempt+1;
  update public.workflow_runs set status='running',attempt=v_attempt,current_node_id=null,state=jsonb_build_object('retried_from_attempt',v_run.attempt),finished_at=null where id=v_run.id;
  insert into public.jobs(tenant_id,kind,payload) values(v_run.tenant_id,'workflow',jsonb_build_object('run_id',v_run.id)) returning id into v_job_id;
  insert into public.outbox(tenant_id,topic,payload) values(v_run.tenant_id,'job.workflow',jsonb_build_object('job_id',v_job_id,'kind','workflow'));
  return v_attempt;
end; $$;

revoke all on function public.retry_workflow_run(uuid) from public,anon;
grant execute on function public.retry_workflow_run(uuid) to authenticated;

commit;
