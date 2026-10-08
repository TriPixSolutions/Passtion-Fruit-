-- Run after 202610080001_worker_trigger.sql has been applied.
-- The trigger secret is generated inside Postgres, stored encrypted in Vault and
-- represented in the application schema only by its SHA-256 digest.
do $$
declare
  v_worker_url text := 'https://lavender-pheasant-832363.hostingersite.com/api/internal/worker';
  v_worker_secret text := encode(gen_random_bytes(48), 'base64');
  v_worker_url_id uuid;
  v_worker_secret_id uuid;
begin
  select id into v_worker_url_id from vault.secrets where name = 'pf_worker_url';
  if v_worker_url_id is null then
    perform vault.create_secret(v_worker_url, 'pf_worker_url');
  else
    perform vault.update_secret(v_worker_url_id, v_worker_url, 'pf_worker_url');
  end if;

  select id into v_worker_secret_id from vault.secrets where name = 'pf_worker_secret';
  if v_worker_secret_id is null then
    perform vault.create_secret(v_worker_secret, 'pf_worker_secret');
  else
    perform vault.update_secret(v_worker_secret_id, v_worker_secret, 'pf_worker_secret');
  end if;

  insert into public.worker_trigger_secrets(id, secret_sha256)
  values (1, encode(digest(v_worker_secret, 'sha256'), 'hex'))
  on conflict (id) do update
  set secret_sha256 = excluded.secret_sha256,
      rotated_at = now();
end $$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'passion-fruit-worker-every-minute';

select cron.schedule(
  'passion-fruit-worker-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'pf_worker_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'pf_worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

select jobid, jobname, schedule, active
from cron.job
where jobname = 'passion-fruit-worker-every-minute';
