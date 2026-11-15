-- Scrull AI: migração 7 — vídeos dos clientes e reels
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run
-- Pode rodar mais de uma vez sem problema.

-- Vídeos que o cliente envia pelo painel. O arquivo fica no Storage (pasta artes/videos/<cliente>/).
-- status: recebido (guardado, aguardando edição) → editando (no serviço de edição com IA)
--         → pronto (editado) | erro
create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  caminho text not null,                 -- caminho do arquivo original no Storage
  url_original text not null,
  url_editado text,                      -- vídeo editado pela IA (legendas, cortes), quando houver
  descricao text,                        -- o que o cliente contou sobre o vídeo
  duracao_s numeric,
  status text not null default 'recebido'
    check (status in ('recebido','editando','pronto','erro')),
  edicao_id text,                        -- id do projeto no serviço de edição (Submagic)
  post_id uuid references posts(id) on delete set null,
  erro_msg text,
  criado_em timestamptz not null default now()
);
create index if not exists videos_cliente on videos (cliente_id, criado_em desc);
create index if not exists videos_edicao on videos (edicao_id);

alter table videos enable row level security;
drop policy if exists "cliente ve os proprios videos" on videos;
create policy "cliente ve os proprios videos" on videos
  for select using (cliente_id = auth.uid());

-- Posts: um post pode ser um reels (vídeo) em vez de uma arte
alter table posts add column if not exists video_url text;
-- O Instagram leva alguns minutos para processar um vídeo: o "container" fica guardado
-- e a fila de publicação termina o trabalho na rodada seguinte.
alter table posts add column if not exists ig_container_id text;

notify pgrst, 'reload schema';

-- Vídeos ficam liberados para o plano Premium (e para a conta da dona do app).
-- Para liberar uma conta piloto, troque o nome e rode a linha abaixo sem os "--":
-- update clientes set plano_id = 'premium' where nome_empresa ilike '%romana%';
