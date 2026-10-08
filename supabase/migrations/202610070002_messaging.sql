begin;

create extension if not exists pgmq;

create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  key_id text not null,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  unique (id, tenant_id)
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null default 'meta_whatsapp' check (provider = 'meta_whatsapp'),
  display_name text not null,
  phone_number_id text not null unique,
  whatsapp_business_account_id text not null,
  credential_id uuid not null,
  status text not null default 'active' check (status in ('pending', 'active', 'paused', 'revoked')),
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (credential_id, tenant_id) references public.integration_credentials(id, tenant_id) on delete restrict
);

create index channels_tenant_idx on public.channels(tenant_id, status);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  wa_id text not null,
  phone_e164 text,
  display_name text,
  consent_status text not null default 'unknown' check (consent_status in ('unknown', 'opted_in', 'opted_out')),
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, wa_id),
  unique (id, tenant_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  channel_id uuid not null,
  contact_id uuid not null,
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'blocked')),
  assigned_user_id uuid references auth.users(id) on delete set null,
  ownership text not null default 'human' check (ownership in ('human', 'automation')),
  ownership_generation integer not null default 1 check (ownership_generation > 0),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, channel_id, contact_id),
  unique (id, tenant_id),
  foreign key (channel_id, tenant_id) references public.channels(id, tenant_id) on delete restrict,
  foreign key (contact_id, tenant_id) references public.contacts(id, tenant_id) on delete restrict
);

create index conversations_tenant_activity_idx on public.conversations(tenant_id, last_message_at desc nulls last);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null,
  channel_id uuid not null,
  contact_id uuid not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  origin text not null check (origin in ('customer', 'manual', 'campaign', 'reminder', 'workflow', 'ai')),
  status text not null check (status in ('received', 'queued', 'dispatching', 'accepted', 'sent', 'delivered', 'read', 'failed', 'unknown', 'cancelled')),
  provider_message_id text,
  idempotency_key text,
  content jsonb not null,
  error_code text,
  expires_at timestamptz,
  accepted_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (conversation_id, tenant_id) references public.conversations(id, tenant_id) on delete cascade,
  foreign key (channel_id, tenant_id) references public.channels(id, tenant_id) on delete restrict,
  foreign key (contact_id, tenant_id) references public.contacts(id, tenant_id) on delete restrict
);

create unique index messages_tenant_provider_id_idx on public.messages(tenant_id, provider_message_id) where provider_message_id is not null;
create unique index messages_tenant_idempotency_idx on public.messages(tenant_id, idempotency_key) where idempotency_key is not null;
create index messages_conversation_created_idx on public.messages(tenant_id, conversation_id, created_at desc);

create table public.message_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  message_id uuid not null,
  attempt_no integer not null check (attempt_no > 0),
  outcome text not null check (outcome in ('started', 'accepted', 'rejected', 'unknown')),
  provider_reference text,
  error_code text,
  error_detail text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (message_id, attempt_no),
  foreign key (message_id, tenant_id) references public.messages(id, tenant_id) on delete cascade
);

create table public.message_status_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  message_id uuid not null,
  provider_event_key text not null,
  status text not null,
  occurred_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider_event_key),
  foreign key (message_id, tenant_id) references public.messages(id, tenant_id) on delete cascade
);

create table public.webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  provider text not null default 'meta_whatsapp',
  phone_number_id text,
  fingerprint text not null unique,
  payload jsonb not null,
  state text not null check (state in ('pending', 'processed', 'quarantined', 'failed')),
  failure_reason text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('inbound', 'outbound', 'campaign', 'schedule', 'workflow', 'ai', 'integration')),
  schema_version integer not null default 1,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'retry', 'completed', 'dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 8,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_ready_idx on public.jobs(status, available_at, created_at) where status in ('queued', 'retry');

create table public.outbox (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants(id) on delete cascade,
  topic text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index outbox_unpublished_idx on public.outbox(id) where published_at is null;

alter table public.integration_credentials enable row level security;
alter table public.channels enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_attempts enable row level security;
alter table public.message_status_events enable row level security;
alter table public.webhook_receipts enable row level security;
alter table public.jobs enable row level security;
alter table public.outbox enable row level security;

create policy channels_member_read on public.channels for select to authenticated using (public.is_tenant_member(tenant_id));
create policy contacts_member_select on public.contacts for select to authenticated using (public.is_tenant_member(tenant_id));
create policy contacts_member_insert on public.contacts for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy contacts_member_update on public.contacts for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy contacts_manager_delete on public.contacts for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy conversations_member_select on public.conversations for select to authenticated using (public.is_tenant_member(tenant_id));
create policy conversations_member_insert on public.conversations for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy conversations_member_update on public.conversations for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy conversations_manager_delete on public.conversations for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy messages_member_read on public.messages for select to authenticated using (public.is_tenant_member(tenant_id));
create policy attempts_manager_read on public.message_attempts for select to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']));
create policy status_events_member_read on public.message_status_events for select to authenticated using (public.is_tenant_member(tenant_id));

select pgmq.create('pf_jobs');

create or replace function public.enqueue_outbound_message(
  p_tenant_id uuid,
  p_channel_id uuid,
  p_contact_id uuid,
  p_conversation_id uuid,
  p_idempotency_key text,
  p_origin text,
  p_content jsonb,
  p_expected_ownership_generation integer,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conversation public.conversations%rowtype;
  v_message_id uuid;
  v_job_id uuid;
  v_feature text;
begin
  if not public.is_tenant_member(p_tenant_id) then raise exception 'tenant_access_denied' using errcode = '42501'; end if;
  if p_expires_at <= now() then raise exception 'message_expired' using errcode = '22023'; end if;
  if char_length(trim(p_idempotency_key)) not between 8 and 128 then raise exception 'invalid_idempotency_key' using errcode = '22023'; end if;

  v_feature := case when p_origin = 'campaign' then 'campaigns' when p_origin = 'workflow' then 'workflows' when p_origin = 'ai' then 'ai_auto_reply' else 'manual_messages' end;
  if not exists(select 1 from public.tenant_features where tenant_id = p_tenant_id and feature_key = v_feature and enabled) then
    raise exception 'feature_disabled' using errcode = '42501';
  end if;

  if p_conversation_id is null then
    insert into public.conversations(tenant_id, channel_id, contact_id)
    values (p_tenant_id, p_channel_id, p_contact_id)
    on conflict (tenant_id, channel_id, contact_id) do update set updated_at = now()
    returning * into v_conversation;
  else
    select * into v_conversation from public.conversations where id = p_conversation_id and tenant_id = p_tenant_id for update;
  end if;

  if v_conversation.id is null then raise exception 'conversation_not_found' using errcode = 'P0002'; end if;
  if p_expected_ownership_generation is not null and v_conversation.ownership_generation <> p_expected_ownership_generation then
    raise exception 'conversation_ownership_changed' using errcode = '40001';
  end if;

  insert into public.messages(tenant_id, conversation_id, channel_id, contact_id, direction, origin, status, idempotency_key, content, expires_at)
  values (p_tenant_id, v_conversation.id, p_channel_id, p_contact_id, 'outbound', p_origin, 'queued', trim(p_idempotency_key), p_content, p_expires_at)
  on conflict (tenant_id, idempotency_key) where idempotency_key is not null do update set updated_at = public.messages.updated_at
  returning id into v_message_id;

  if not exists(select 1 from public.jobs where kind = 'outbound' and payload->>'message_id' = v_message_id::text and status <> 'dead') then
    insert into public.jobs(tenant_id, kind, payload) values (p_tenant_id, 'outbound', jsonb_build_object('message_id', v_message_id)) returning id into v_job_id;
    insert into public.outbox(tenant_id, topic, payload) values (p_tenant_id, 'job.outbound', jsonb_build_object('job_id', v_job_id, 'kind', 'outbound'));
  end if;

  return v_message_id;
end;
$$;

revoke all on function public.enqueue_outbound_message(uuid, uuid, uuid, uuid, text, text, jsonb, integer, timestamptz) from public, anon;
grant execute on function public.enqueue_outbound_message(uuid, uuid, uuid, uuid, text, text, jsonb, integer, timestamptz) to authenticated;

create or replace function public.ingest_meta_webhook(p_phone_number_id text, p_fingerprint text, p_payload jsonb)
returns table(receipt_id uuid, duplicate boolean, state text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
  v_receipt_id uuid;
  v_job_id uuid;
  v_state text;
begin
  select r.id, r.state into v_receipt_id, v_state from public.webhook_receipts r where r.fingerprint = p_fingerprint;
  if v_receipt_id is not null then return query select v_receipt_id, true, v_state; return; end if;

  select c.tenant_id into v_tenant_id from public.channels c where c.phone_number_id = p_phone_number_id and c.status = 'active';
  v_state := case when v_tenant_id is null then 'quarantined' else 'pending' end;
  insert into public.webhook_receipts(tenant_id, phone_number_id, fingerprint, payload, state, failure_reason)
  values (v_tenant_id, p_phone_number_id, p_fingerprint, p_payload, v_state, case when v_tenant_id is null then 'unknown_phone_number_id' end)
  returning id into v_receipt_id;

  if v_tenant_id is not null then
    insert into public.jobs(tenant_id, kind, payload) values (v_tenant_id, 'inbound', jsonb_build_object('receipt_id', v_receipt_id)) returning id into v_job_id;
    insert into public.outbox(tenant_id, topic, payload) values (v_tenant_id, 'job.inbound', jsonb_build_object('job_id', v_job_id, 'kind', 'inbound'));
  end if;
  return query select v_receipt_id, false, v_state;
end;
$$;

revoke all on function public.ingest_meta_webhook(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_meta_webhook(text, text, jsonb) to service_role;

create or replace function public.relay_outbox(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, pgmq, pg_temp
as $$
declare
  v_record record;
  v_count integer := 0;
begin
  for v_record in select * from public.outbox where published_at is null order by id for update skip locked limit greatest(1, least(p_limit, 500)) loop
    perform pgmq.send('pf_jobs', v_record.payload);
    update public.outbox set published_at = now() where id = v_record.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.claim_jobs(p_limit integer default 10, p_visibility_seconds integer default 60)
returns table(queue_message_id bigint, job_id uuid, tenant_id uuid, kind text, payload jsonb, attempts integer)
language plpgsql
security definer
set search_path = public, pgmq, pg_temp
as $$
declare
  v_item record;
  v_job public.jobs%rowtype;
begin
  perform public.relay_outbox(greatest(1, least(p_limit * 2, 100)));
  for v_item in select * from pgmq.read('pf_jobs', greatest(10, p_visibility_seconds), greatest(1, least(p_limit, 50))) loop
    select * into v_job from public.jobs where id = (v_item.message->>'job_id')::uuid for update;
    if v_job.id is null then
      perform pgmq.archive('pf_jobs', v_item.msg_id);
      continue;
    end if;
    if v_job.status in ('completed', 'dead') then
      perform pgmq.archive('pf_jobs', v_item.msg_id);
      continue;
    end if;
    if v_job.available_at > now() then continue; end if;
    update public.jobs set status = 'processing', attempts = public.jobs.attempts + 1, locked_at = now(), updated_at = now() where id = v_job.id returning * into v_job;
    return query select v_item.msg_id, v_job.id, v_job.tenant_id, v_job.kind, v_job.payload, v_job.attempts;
  end loop;
end;
$$;

create or replace function public.finish_job(p_queue_message_id bigint, p_job_id uuid, p_success boolean, p_error text default null, p_retry_delay_seconds integer default 30)
returns void
language plpgsql
security definer
set search_path = public, pgmq, pg_temp
as $$
declare
  v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null then raise exception 'job_not_found'; end if;
  if p_success then
    update public.jobs set status = 'completed', updated_at = now(), last_error = null where id = p_job_id;
    perform pgmq.delete('pf_jobs', p_queue_message_id);
  elsif v_job.attempts >= v_job.max_attempts then
    update public.jobs set status = 'dead', updated_at = now(), last_error = left(p_error, 1000) where id = p_job_id;
    perform pgmq.archive('pf_jobs', p_queue_message_id);
  else
    update public.jobs set status = 'retry', available_at = now() + make_interval(secs => greatest(1, p_retry_delay_seconds)), updated_at = now(), last_error = left(p_error, 1000) where id = p_job_id;
  end if;
end;
$$;

revoke all on function public.relay_outbox(integer) from public, anon, authenticated;
revoke all on function public.claim_jobs(integer, integer) from public, anon, authenticated;
revoke all on function public.finish_job(bigint, uuid, boolean, text, integer) from public, anon, authenticated;
grant execute on function public.relay_outbox(integer) to service_role;
grant execute on function public.claim_jobs(integer, integer) to service_role;
grant execute on function public.finish_job(bigint, uuid, boolean, text, integer) to service_role;

commit;
