begin;

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category text not null check (category in ('store','crm')),
  provider text not null check (provider in ('shopify','woocommerce','custom')),
  name text not null check (char_length(trim(name)) between 2 and 100),
  status text not null default 'setup_required' check (status in ('setup_required','sandbox','connected','syncing','error','reauth_required','disabled')),
  base_url text,
  scopes text[] not null default '{}',
  last_sync_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);

create table public.integration_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null,
  resource text not null check (resource in ('products','orders','customers','inventory')),
  cursor text,
  checkpoint_at timestamptz not null default now(),
  unique (connection_id, resource),
  foreign key (connection_id, tenant_id) references public.integration_connections(id, tenant_id) on delete cascade
);

create table public.commerce_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null,
  external_id text not null,
  title text not null check (char_length(trim(title)) between 1 and 240),
  handle text,
  status text not null default 'active' check (status in ('active','draft','archived')),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (connection_id, external_id),
  foreign key (connection_id, tenant_id) references public.integration_connections(id, tenant_id) on delete cascade
);

create table public.commerce_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null,
  product_id uuid not null,
  external_id text not null,
  title text not null default 'Default',
  sku text,
  price_minor bigint not null default 0 check (price_minor >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  inventory_quantity integer,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (connection_id, external_id),
  foreign key (connection_id, tenant_id) references public.integration_connections(id, tenant_id) on delete cascade,
  foreign key (product_id, tenant_id) references public.commerce_products(id, tenant_id) on delete cascade
);

create table public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null,
  contact_id uuid,
  external_id text not null,
  order_number text not null,
  customer_name text,
  customer_phone text,
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  financial_status text not null default 'pending' check (financial_status in ('pending','authorized','paid','partially_refunded','refunded','voided')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled','partial','fulfilled','cancelled','returned')),
  placed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (connection_id, external_id),
  foreign key (connection_id, tenant_id) references public.integration_connections(id, tenant_id) on delete cascade,
  foreign key (contact_id, tenant_id) references public.contacts(id, tenant_id) on delete set null
);

create table public.commerce_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null,
  product_id uuid,
  variant_id uuid,
  title text not null,
  sku text,
  quantity integer not null check (quantity > 0),
  unit_price_minor bigint not null default 0 check (unit_price_minor >= 0),
  created_at timestamptz not null default now(),
  foreign key (order_id, tenant_id) references public.commerce_orders(id, tenant_id) on delete cascade,
  foreign key (product_id, tenant_id) references public.commerce_products(id, tenant_id) on delete set null,
  foreign key (variant_id, tenant_id) references public.commerce_variants(id, tenant_id) on delete set null
);

create table public.commerce_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (connection_id, provider_event_id),
  foreign key (connection_id, tenant_id) references public.integration_connections(id, tenant_id) on delete cascade
);

create index commerce_products_tenant_idx on public.commerce_products(tenant_id, updated_at desc);
create index commerce_orders_tenant_idx on public.commerce_orders(tenant_id, placed_at desc);
create index commerce_events_unprocessed_idx on public.commerce_events(tenant_id, received_at) where processed_at is null;

alter table public.integration_connections enable row level security;
alter table public.integration_sync_cursors enable row level security;
alter table public.commerce_products enable row level security;
alter table public.commerce_variants enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.commerce_order_items enable row level security;
alter table public.commerce_events enable row level security;

create policy integration_connections_member_read on public.integration_connections for select to authenticated using (public.is_tenant_member(tenant_id) and public.feature_enabled(tenant_id,'commerce'));
create policy integration_connections_manager_write on public.integration_connections for all to authenticated using (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce')) with check (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce'));
create policy integration_sync_member_read on public.integration_sync_cursors for select to authenticated using (public.is_tenant_member(tenant_id) and public.feature_enabled(tenant_id,'commerce'));
create policy integration_sync_manager_write on public.integration_sync_cursors for all to authenticated using (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce')) with check (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce'));
create policy commerce_products_member_read on public.commerce_products for select to authenticated using (public.is_tenant_member(tenant_id) and public.feature_enabled(tenant_id,'commerce'));
create policy commerce_products_manager_write on public.commerce_products for all to authenticated using (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce')) with check (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce'));
create policy commerce_variants_member_read on public.commerce_variants for select to authenticated using (public.is_tenant_member(tenant_id) and public.feature_enabled(tenant_id,'commerce'));
create policy commerce_variants_manager_write on public.commerce_variants for all to authenticated using (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce')) with check (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce'));
create policy commerce_orders_member_read on public.commerce_orders for select to authenticated using (public.is_tenant_member(tenant_id) and public.feature_enabled(tenant_id,'commerce'));
create policy commerce_orders_manager_write on public.commerce_orders for all to authenticated using (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce')) with check (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce'));
create policy commerce_items_member_read on public.commerce_order_items for select to authenticated using (public.is_tenant_member(tenant_id) and public.feature_enabled(tenant_id,'commerce'));
create policy commerce_items_manager_write on public.commerce_order_items for all to authenticated using (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce')) with check (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce'));
create policy commerce_events_member_read on public.commerce_events for select to authenticated using (public.is_tenant_member(tenant_id) and public.feature_enabled(tenant_id,'commerce'));
create policy commerce_events_manager_write on public.commerce_events for all to authenticated using (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce')) with check (public.has_tenant_role(tenant_id,array['owner','manager']) and public.feature_enabled(tenant_id,'commerce'));

grant select,insert,update,delete on public.integration_connections,public.integration_sync_cursors,public.commerce_products,public.commerce_variants,public.commerce_orders,public.commerce_order_items,public.commerce_events to authenticated;

create or replace function public.import_sandbox_commerce_fixture(p_connection_id uuid,p_product jsonb,p_order jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_connection public.integration_connections%rowtype;v_product_id uuid;v_variant_id uuid;v_order_id uuid;
begin
  select * into v_connection from public.integration_connections where id=p_connection_id;
  if v_connection.id is null then raise exception 'connection_not_found' using errcode='P0002';end if;
  if v_connection.status<>'sandbox' then raise exception 'sandbox_connection_required' using errcode='42501';end if;
  if not public.has_tenant_role(v_connection.tenant_id,array['owner','manager']) or not public.feature_enabled(v_connection.tenant_id,'commerce') then raise exception 'tenant_access_denied' using errcode='42501';end if;
  insert into public.commerce_products(tenant_id,connection_id,external_id,title,handle,status) values(v_connection.tenant_id,v_connection.id,p_product->>'externalId',p_product->>'title',lower(regexp_replace(p_product->>'title','[^a-zA-Z0-9]+','-','g')),'active')
  on conflict(connection_id,external_id) do update set title=excluded.title,updated_at=now() returning id into v_product_id;
  insert into public.commerce_variants(tenant_id,connection_id,product_id,external_id,title,sku,price_minor,currency,inventory_quantity,available) values(v_connection.tenant_id,v_connection.id,v_product_id,(p_product->>'externalId')||'-default','Default',nullif(p_product->>'sku',''),(p_product->>'priceMinor')::bigint,p_product->>'currency',nullif(p_product->>'inventoryQuantity','')::integer,true)
  on conflict(connection_id,external_id) do update set sku=excluded.sku,price_minor=excluded.price_minor,currency=excluded.currency,inventory_quantity=excluded.inventory_quantity,updated_at=now() returning id into v_variant_id;
  insert into public.commerce_orders(tenant_id,connection_id,external_id,order_number,customer_name,customer_phone,currency,subtotal_minor,total_minor,financial_status,fulfillment_status,placed_at) values(v_connection.tenant_id,v_connection.id,p_order->>'externalId',p_order->>'orderNumber',nullif(p_order->>'customerName',''),nullif(p_order->>'customerPhone',''),p_order->>'currency',(p_order->>'totalMinor')::bigint,(p_order->>'totalMinor')::bigint,p_order->>'financialStatus',p_order->>'fulfillmentStatus',(p_order->>'placedAt')::timestamptz)
  on conflict(connection_id,external_id) do update set total_minor=excluded.total_minor,financial_status=excluded.financial_status,fulfillment_status=excluded.fulfillment_status,updated_at=now() returning id into v_order_id;
  delete from public.commerce_order_items where order_id=v_order_id and tenant_id=v_connection.tenant_id;
  insert into public.commerce_order_items(tenant_id,order_id,product_id,variant_id,title,sku,quantity,unit_price_minor) values(v_connection.tenant_id,v_order_id,v_product_id,v_variant_id,p_product->>'title',nullif(p_product->>'sku',''),1,(p_product->>'priceMinor')::bigint);
  update public.integration_connections set last_sync_at=now(),updated_at=now(),last_error=null where id=v_connection.id;
  insert into public.commerce_events(tenant_id,connection_id,provider_event_id,event_type,payload,processed_at) values(v_connection.tenant_id,v_connection.id,'sandbox-'||(p_order->>'externalId'),'order.synced',jsonb_build_object('orderId',v_order_id,'productId',v_product_id),now()) on conflict(connection_id,provider_event_id) do nothing;
  return jsonb_build_object('productId',v_product_id,'orderId',v_order_id);
end;$$;
revoke all on function public.import_sandbox_commerce_fixture(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.import_sandbox_commerce_fixture(uuid,jsonb,jsonb) to authenticated;

commit;
