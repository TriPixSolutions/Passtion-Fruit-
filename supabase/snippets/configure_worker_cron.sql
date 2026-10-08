-- Run manually after replacing the two placeholders. Do not commit real values.
-- Vault keeps the worker URL and secret out of the scheduled command text.
select vault.create_secret('https://YOUR_APP_HOST/api/internal/worker', 'pf_worker_url');
select vault.create_secret('YOUR_LONG_WORKER_SECRET', 'pf_worker_secret');

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
