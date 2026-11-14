-- Scrull AI: migração 2 — briefing da marca, logo e imagens dos posts
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run
-- Pode rodar mais de uma vez sem problema.

-- Briefing da marca (sobre, público, diferencial, história, oferta, cores) e logo
alter table clientes add column if not exists briefing jsonb not null default '{}'::jsonb;
alter table clientes add column if not exists logo_url text;

-- O cliente pode editar o próprio briefing e a logo pelo app
grant update (nome_empresa, ramo, tom_de_voz, briefing, logo_url) on clientes to authenticated;

-- Posts: 3 tópicos da arte e a descrição usada para gerar a imagem
alter table posts add column if not exists topicos text[] default '{}';
alter table posts add column if not exists prompt_imagem text;
alter table posts add column if not exists tema text;

-- Pasta pública para as artes e as logos (o servidor grava; qualquer um pode ver pela URL)
insert into storage.buckets (id, name, public)
  values ('artes', 'artes', true)
  on conflict (id) do nothing;
