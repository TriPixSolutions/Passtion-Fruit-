create table public.whatsapp_message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel_id uuid not null,
  provider_template_id text not null,
  name text not null,
  language text not null,
  category text not null,
  status text not null,
  components jsonb not null default '[]'::jsonb,
  quality_score jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, provider_template_id),
  unique (channel_id, name, language),
  foreign key (channel_id, tenant_id) references public.channels(id, tenant_id) on delete cascade
);
create index whatsapp_templates_tenant_status_idx on public.whatsapp_message_templates(tenant_id, channel_id, status, name);
alter table public.whatsapp_message_templates enable row level security;
create policy whatsapp_templates_member_read on public.whatsapp_message_templates for select to authenticated using (public.is_tenant_member(tenant_id));
create trigger whatsapp_message_templates_touch before update on public.whatsapp_message_templates for each row execute function public.touch_updated_at();
grant select on public.whatsapp_message_templates to authenticated;
