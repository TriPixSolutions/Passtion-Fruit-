-- PostgREST cannot target a partial unique index for an UPSERT conflict target.
-- PostgreSQL unique constraints already permit multiple NULL values, so a full
-- constraint preserves unsent outbound rows while making inbound provider IDs
-- safely idempotent under concurrent webhook delivery.
drop index if exists public.messages_tenant_provider_id_idx;

alter table public.messages
  add constraint messages_tenant_provider_id_key
  unique (tenant_id, provider_message_id);
