begin;
insert into public.feature_definitions(key,name,description,default_enabled) values('crm','CRM','Deals, follow-up tasks and customer activity',false) on conflict(key) do nothing;
insert into public.tenant_features(tenant_id,feature_key,enabled,limits,revision,updated_by)
select tenant_id,'crm',enabled,'{}'::jsonb,1,updated_by from public.tenant_features where feature_key='contacts' and enabled
on conflict(tenant_id,feature_key) do nothing;

create table public.crm_deals(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,contact_id uuid not null,title text not null check(char_length(trim(title)) between 2 and 160),stage text not null default 'new' check(stage in('new','qualified','proposal','negotiation','won','lost')),value_minor bigint not null default 0 check(value_minor>=0),currency text not null default 'INR' check(currency~'^[A-Z]{3}$'),owner_user_id uuid references auth.users(id) on delete set null,expected_close_at timestamptz,created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(id,tenant_id),foreign key(contact_id,tenant_id) references public.contacts(id,tenant_id) on delete cascade
);
create table public.crm_tasks(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,contact_id uuid,deal_id uuid,title text not null check(char_length(trim(title)) between 2 and 200),status text not null default 'open' check(status in('open','in_progress','completed','cancelled')),priority text not null default 'normal' check(priority in('low','normal','high','urgent')),due_at timestamptz,assigned_user_id uuid references auth.users(id) on delete set null,created_by uuid references auth.users(id) on delete set null,completed_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(contact_id,tenant_id) references public.contacts(id,tenant_id) on delete cascade,foreign key(deal_id,tenant_id) references public.crm_deals(id,tenant_id) on delete cascade,check(contact_id is not null or deal_id is not null)
);
create table public.crm_activities(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,contact_id uuid not null,deal_id uuid,event_type text not null,summary text not null,metadata jsonb not null default '{}',actor_id uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),foreign key(contact_id,tenant_id) references public.contacts(id,tenant_id) on delete cascade,foreign key(deal_id,tenant_id) references public.crm_deals(id,tenant_id) on delete cascade
);
create index crm_deals_stage_idx on public.crm_deals(tenant_id,stage,updated_at desc);create index crm_tasks_due_idx on public.crm_tasks(tenant_id,status,due_at);create index crm_activities_contact_idx on public.crm_activities(tenant_id,contact_id,created_at desc);
alter table public.crm_deals enable row level security;alter table public.crm_tasks enable row level security;alter table public.crm_activities enable row level security;
create policy crm_deals_member_read on public.crm_deals for select to authenticated using(public.is_tenant_member(tenant_id) and public.feature_enabled(tenant_id,'crm'));create policy crm_deals_member_write on public.crm_deals for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','manager','agent']) and public.feature_enabled(tenant_id,'crm')) with check(public.has_tenant_role(tenant_id,array['owner','manager','agent']) and public.feature_enabled(tenant_id,'crm'));
create policy crm_tasks_member_read on public.crm_tasks for select to authenticated using(public.is_tenant_member(tenant_id) and public.feature_enabled(tenant_id,'crm'));create policy crm_tasks_member_write on public.crm_tasks for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','manager','agent']) and public.feature_enabled(tenant_id,'crm')) with check(public.has_tenant_role(tenant_id,array['owner','manager','agent']) and public.feature_enabled(tenant_id,'crm'));
create policy crm_activities_member_read on public.crm_activities for select to authenticated using(public.is_tenant_member(tenant_id) and public.feature_enabled(tenant_id,'crm'));create policy crm_activities_member_insert on public.crm_activities for insert to authenticated with check(public.has_tenant_role(tenant_id,array['owner','manager','agent']) and public.feature_enabled(tenant_id,'crm'));
grant select,insert,update,delete on public.crm_deals,public.crm_tasks to authenticated;grant select,insert on public.crm_activities to authenticated;
create or replace function public.record_crm_activity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_contact_id uuid;
begin
 if tg_table_name='crm_deals' then
  insert into public.crm_activities(tenant_id,contact_id,deal_id,event_type,summary,actor_id) values(new.tenant_id,new.contact_id,new.id,case when tg_op='INSERT' then 'deal.created' else 'deal.updated' end,new.title,auth.uid());
 else
  v_contact_id:=new.contact_id;if v_contact_id is null then select contact_id into v_contact_id from public.crm_deals where id=new.deal_id and tenant_id=new.tenant_id;end if;
  insert into public.crm_activities(tenant_id,contact_id,deal_id,event_type,summary,actor_id) values(new.tenant_id,v_contact_id,new.deal_id,case when new.status='completed' then 'task.completed' when tg_op='INSERT' then 'task.created' else 'task.updated' end,new.title,auth.uid());
 end if;return new;
end;$$;
create trigger crm_deal_activity after insert or update of stage,value_minor on public.crm_deals for each row execute function public.record_crm_activity();
create trigger crm_task_activity after insert or update of status on public.crm_tasks for each row execute function public.record_crm_activity();
commit;
