-- Scrull AI: migração 11 — painel de publicações (status "publicando", confirmação real e histórico)
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run

-- 1) Novo status "publicando": trava o post enquanto ele está indo ao ar (evita publicar duas vezes)
do $$ declare c text; begin
  for c in select conname from pg_constraint
    where conrelid = 'public.posts'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%'
  loop execute format('alter table posts drop constraint %I', c); end loop;
end $$;
alter table posts add constraint posts_status_check
  check (status in ('rascunho','aguardando_aprovacao','aprovado','publicando','recusado','publicado','erro'));

-- 2) Confirmação real da plataforma: quando saiu de verdade e o link do post no Instagram
alter table posts add column if not exists publicado_em timestamptz;
alter table posts add column if not exists ig_permalink text;
alter table posts add column if not exists publicando_desde timestamptz;

-- 3) Histórico de alterações e aprovações de cada post
create table if not exists post_historico (
  id bigserial primary key,
  post_id uuid not null references posts(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  acao text not null,           -- criado, aprovado, recusado, arte, legenda, horario, publicando, publicado, falhou
  detalhe text,
  quem text,                    -- cliente, dono ou automático
  em timestamptz not null default now()
);
create index if not exists post_historico_post on post_historico (post_id, em desc);
alter table post_historico enable row level security;
drop policy if exists "cliente ve o proprio historico" on post_historico;
create policy "cliente ve o proprio historico" on post_historico for select using (cliente_id = auth.uid());

notify pgrst, 'reload schema';
