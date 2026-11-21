-- Scrull AI: migração 12 — engajamento de cada post publicado pelo Scrull
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run

-- Números do Instagram (alcance, curtidas, comentários, salvamentos, compartilhamentos) e quando foram lidos.
-- São lidos 1 dia e 3 dias depois da publicação; com eles o Scrull aprende o que engaja no público de cada cliente.
alter table posts add column if not exists metricas jsonb;
alter table posts add column if not exists metricas_em timestamptz;
create index if not exists posts_metricas on posts (publicado_em) where status = 'publicado';

notify pgrst, 'reload schema';
