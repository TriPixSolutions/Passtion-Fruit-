begin;

alter table public.contacts drop constraint contacts_assignee_fk;
alter table public.contacts add constraint contacts_assignee_fk
  foreign key (tenant_id, assigned_user_id)
  references public.memberships(tenant_id, user_id)
  on delete set null (assigned_user_id);

alter table public.contacts drop constraint contacts_team_fk;
alter table public.contacts add constraint contacts_team_fk
  foreign key (team_id, tenant_id)
  references public.teams(id, tenant_id)
  on delete set null (team_id);

alter table public.conversations drop constraint conversations_team_fk;
alter table public.conversations add constraint conversations_team_fk
  foreign key (team_id, tenant_id)
  references public.teams(id, tenant_id)
  on delete set null (team_id);

commit;
