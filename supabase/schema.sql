-- Scrull AI: banco de dados (Supabase / PostgreSQL)
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run

-- Planos ------------------------------------------------------------------
create table planos (
  id text primary key,                 -- 'basico', 'completo', 'premium'
  nome text not null,
  preco_centavos int not null,         -- 12700 = R$ 127,00
  posts_por_semana int not null,
  ativo boolean not null default true
);

insert into planos (id, nome, preco_centavos, posts_por_semana) values
  ('basico',   'Básico',   9700,  3),
  ('completo', 'Completo', 12700, 7),
  ('premium',  'Premium',  19990, 7);

-- Clientes (um por login do Supabase) -----------------------------------
create table clientes (
  id uuid primary key references auth.users(id) on delete cascade,
  nome_empresa text not null,
  ramo text,
  tom_de_voz text default 'Próximo e acolhedor',
  plano_id text references planos(id) default 'completo',
  teste_ate timestamptz not null default (now() + interval '7 days'),
  assinatura text not null default 'teste'
    check (assinatura in ('teste','ativa','atrasada','cancelada')),
  criado_em timestamptz not null default now()
);

-- Configurações de cada cliente -----------------------------------------
create table configuracoes (
  cliente_id uuid primary key references clientes(id) on delete cascade,
  postar_sem_aprovacao boolean not null default false,
  melhor_horario boolean not null default true,
  pausado boolean not null default false
);

-- Contas do Instagram conectadas (sem dados sensíveis) -------------------
create table contas_instagram (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  ig_user_id text not null,
  ig_username text,
  ativa boolean not null default true,
  conectada_em timestamptz not null default now(),
  unique (cliente_id, ig_user_id)
);

-- Tokens do Instagram: tabela SEM política de acesso. ---------------------
-- Só o servidor (service role) consegue ler. O token fica cifrado.
create table tokens_instagram (
  conta_id uuid primary key references contas_instagram(id) on delete cascade,
  token_cifrado text not null,
  expira_em timestamptz not null,
  atualizado_em timestamptz not null default now()
);

-- Análises do perfil -------------------------------------------------------
create table analises (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas_instagram(id) on delete cascade,
  coletada_em timestamptz not null default now(),
  seguidores int,
  alcance_30d int,
  engajamento numeric(5,2),
  melhores_horarios jsonb,             -- ex.: [{"faixa":"18h","pontuacao":90}]
  tom_detectado text,
  insights jsonb                       -- lista de textos gerados pela IA
);

-- Posts -------------------------------------------------------------------
create table posts (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  conta_id uuid not null references contas_instagram(id) on delete cascade,
  titulo_arte text,
  legenda text not null,
  hashtags text[] default '{}',
  imagem_url text,
  agendado_para timestamptz not null,
  status text not null default 'aguardando_aprovacao'
    check (status in ('rascunho','aguardando_aprovacao','aprovado','recusado','publicado','erro')),
  ig_media_id text,                    -- id do post depois de publicado
  erro_msg text,
  criado_em timestamptz not null default now()
);

-- A fila de publicação procura posts aprovados que já chegaram na hora
create index posts_fila on posts (agendado_para) where status = 'aprovado';
create index posts_cliente on posts (cliente_id, agendado_para);

-- Segurança: cada cliente só enxerga os próprios dados --------------------
alter table clientes          enable row level security;
alter table configuracoes     enable row level security;
alter table contas_instagram  enable row level security;
alter table tokens_instagram  enable row level security;  -- sem política: só o servidor
alter table analises          enable row level security;
alter table posts             enable row level security;
alter table planos            enable row level security;

create policy "ver planos" on planos for select using (true);

create policy "cliente ve o proprio cadastro" on clientes
  for select using (id = auth.uid());
create policy "cliente edita o proprio cadastro" on clientes
  for update using (id = auth.uid());

create policy "cliente gerencia as configuracoes" on configuracoes
  for all using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());

create policy "cliente ve as proprias contas" on contas_instagram
  for select using (cliente_id = auth.uid());

create policy "cliente ve as proprias analises" on analises
  for select using (conta_id in (select id from contas_instagram where cliente_id = auth.uid()));

create policy "cliente ve os proprios posts" on posts
  for select using (cliente_id = auth.uid());
create policy "cliente edita os proprios posts" on posts
  for update using (cliente_id = auth.uid())
  with check (cliente_id = auth.uid() and status in ('aguardando_aprovacao','aprovado','recusado'));

-- Ao criar um login, cria o cadastro e as configurações automaticamente ---
create or replace function criar_cliente_novo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into clientes (id, nome_empresa)
    values (new.id, coalesce(new.raw_user_meta_data->>'nome_empresa', 'Minha empresa'));
  insert into configuracoes (cliente_id) values (new.id);
  return new;
end $$;

create trigger ao_criar_login after insert on auth.users
  for each row execute function criar_cliente_novo();

-- Trava extra: o cliente só pode alterar estes campos pelo app.
-- (plano, assinatura e datas só o servidor muda)
revoke update on clientes from anon, authenticated;
grant update (nome_empresa, ramo, tom_de_voz) on clientes to authenticated;
revoke update on posts from anon, authenticated;
grant update (status, legenda) on posts to authenticated;
