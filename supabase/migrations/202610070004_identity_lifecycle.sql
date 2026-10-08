begin;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.bump_feature_revision()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger tenants_touch before update on public.tenants for each row execute function public.touch_updated_at();
create trigger memberships_touch before update on public.memberships for each row execute function public.touch_updated_at();
create trigger tenant_features_revision before update on public.tenant_features for each row execute function public.bump_feature_revision();
create trigger contacts_touch before update on public.contacts for each row execute function public.touch_updated_at();
create trigger conversations_touch before update on public.conversations for each row execute function public.touch_updated_at();
create trigger messages_touch before update on public.messages for each row execute function public.touch_updated_at();
create trigger channels_touch before update on public.channels for each row execute function public.touch_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.activate_my_memberships()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  update public.memberships set status = 'active', auth_revision = auth_revision + 1 where user_id = auth.uid() and status = 'invited';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.activate_my_memberships() from public, anon;
grant execute on function public.activate_my_memberships() to authenticated;

create or replace function public.bootstrap_platform_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  insert into public.platform_admins(user_id) values (v_user_id) on conflict do nothing;
  return v_user_id;
end;
$$;

revoke all on function public.bootstrap_platform_admin(text) from public, anon, authenticated;
grant execute on function public.bootstrap_platform_admin(text) to service_role;

commit;
