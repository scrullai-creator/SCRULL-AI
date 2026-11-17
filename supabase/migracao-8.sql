-- Scrull AI: migração 8 — lista de aviso do lançamento
create table if not exists lista_aviso (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome_negocio text,
  instagram text,
  origem text,
  criado_em timestamptz default now()
);
create unique index if not exists lista_aviso_email_unico on lista_aviso (lower(email));
alter table lista_aviso enable row level security;
-- sem políticas: só o servidor (chave de serviço) lê e grava
notify pgrst, 'reload schema';
