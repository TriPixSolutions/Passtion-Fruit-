begin;

alter table public.ai_agents
  add column tone text not null default 'helpful' check (tone in ('professional','helpful','friendly','concise')),
  add column supported_languages text[] not null default array['en'],
  add column confidence_threshold numeric(4,3) not null default 0.650 check (confidence_threshold between 0 and 1),
  add column guardrails jsonb not null default '{"handoffOnMissingSource":true,"handoffOnSensitiveIntent":true,"prohibitedTopics":[]}'::jsonb,
  add column published_at timestamptz;

create table public.agent_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_id uuid not null,
  name text not null check (char_length(trim(name)) between 2 and 120),
  kind text not null default 'text' check (kind in ('text','faq','policy','catalogue')),
  status text not null default 'ready' check (status in ('processing','ready','failed','archived')),
  checksum text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (agent_id, checksum),
  foreign key (agent_id, tenant_id) references public.ai_agents(id, tenant_id) on delete cascade
);

create table public.agent_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_id uuid not null,
  source_id uuid not null,
  ordinal integer not null check (ordinal >= 0),
  content text not null check (char_length(trim(content)) between 1 and 4000),
  created_at timestamptz not null default now(),
  unique (source_id, ordinal),
  foreign key (agent_id, tenant_id) references public.ai_agents(id, tenant_id) on delete cascade,
  foreign key (source_id, tenant_id) references public.agent_knowledge_sources(id, tenant_id) on delete cascade
);

create index agent_knowledge_search_idx on public.agent_knowledge_chunks using gin (to_tsvector('simple', content));

create table public.agent_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  agent_id uuid not null,
  prompt text not null check (char_length(trim(prompt)) between 1 and 4000),
  response text,
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  citation_ids uuid[] not null default '{}',
  outcome text not null check (outcome in ('suggested','handoff','blocked','failed')),
  handoff_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (agent_id, tenant_id) references public.ai_agents(id, tenant_id) on delete cascade
);

create index agent_evaluations_agent_idx on public.agent_evaluations(tenant_id, agent_id, created_at desc);

alter table public.agent_knowledge_sources enable row level security;
alter table public.agent_knowledge_chunks enable row level security;
alter table public.agent_evaluations enable row level security;
create policy agent_sources_member_read on public.agent_knowledge_sources for select to authenticated using (public.is_tenant_member(tenant_id));
create policy agent_sources_manager_write on public.agent_knowledge_sources for all to authenticated using (public.has_tenant_role(tenant_id,array['owner','manager'])) with check (public.has_tenant_role(tenant_id,array['owner','manager']));
create policy agent_chunks_member_read on public.agent_knowledge_chunks for select to authenticated using (public.is_tenant_member(tenant_id));
create policy agent_chunks_manager_write on public.agent_knowledge_chunks for all to authenticated using (public.has_tenant_role(tenant_id,array['owner','manager'])) with check (public.has_tenant_role(tenant_id,array['owner','manager']));
create policy agent_evaluations_member_read on public.agent_evaluations for select to authenticated using (public.is_tenant_member(tenant_id));
create policy agent_evaluations_member_insert on public.agent_evaluations for insert to authenticated with check (public.is_tenant_member(tenant_id) and created_by=auth.uid());
grant select,insert,update,delete on public.agent_knowledge_sources,public.agent_knowledge_chunks to authenticated;
grant select,insert on public.agent_evaluations to authenticated;

create or replace function public.search_agent_knowledge(p_agent_id uuid,p_query text,p_limit integer default 5)
returns table(chunk_id uuid,source_id uuid,source_name text,content text,score real)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_agent public.ai_agents%rowtype;
begin
  select * into v_agent from public.ai_agents where id=p_agent_id;
  if v_agent.id is null then raise exception 'agent_not_found' using errcode='P0002';end if;
  if not public.is_tenant_member(v_agent.tenant_id) then raise exception 'tenant_access_denied' using errcode='42501';end if;
  return query select c.id,c.source_id,s.name,c.content,ts_rank_cd(to_tsvector('simple',c.content),plainto_tsquery('simple',p_query))
  from public.agent_knowledge_chunks c join public.agent_knowledge_sources s on s.id=c.source_id and s.tenant_id=c.tenant_id
  where c.agent_id=p_agent_id and c.tenant_id=v_agent.tenant_id and s.status='ready' and to_tsvector('simple',c.content)@@plainto_tsquery('simple',p_query)
  order by 5 desc,c.ordinal limit greatest(1,least(p_limit,10));
end; $$;

revoke all on function public.search_agent_knowledge(uuid,text,integer) from public,anon;
grant execute on function public.search_agent_knowledge(uuid,text,integer) to authenticated;

commit;
