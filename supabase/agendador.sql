-- Scrull AI: agendador da publicação automática
-- A cada 15 minutos o banco chama o app, que publica os posts aprovados cuja hora chegou.
-- Como usar: troque COLE_O_CRON_SECRET_AQUI pelo valor da variável CRON_SECRET da Vercel
-- e rode no Supabase > SQL Editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- remove o agendamento antigo, se existir
select cron.unschedule(jobid) from cron.job where jobname = 'scrull-publicar';

select cron.schedule(
  'scrull-publicar',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://scrull-ai.vercel.app/api/cron/publicar',
    headers := jsonb_build_object('Authorization', 'Bearer COLE_O_CRON_SECRET_AQUI'),
    timeout_milliseconds := 55000
  );
  $$
);
