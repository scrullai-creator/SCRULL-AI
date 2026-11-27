-- Scrull AI: migração 14 — reforço de segurança
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

-- 1) Post já publicado (ou indo ao ar) não pode mais ser alterado pelo cliente direto pela API
drop policy if exists "cliente edita os proprios posts" on posts;
create policy "cliente edita os proprios posts" on posts
  for update using (cliente_id = auth.uid() and status in ('aguardando_aprovacao','aprovado','recusado','erro'))
  with check (cliente_id = auth.uid() and status in ('aguardando_aprovacao','aprovado','recusado'));

-- 2) Tabelas que só o servidor usa: trancadas para o público (o servidor usa a chave secreta e continua funcionando)
alter table if exists oauth_states enable row level security;
alter table if exists lista_aviso enable row level security;
alter table if exists tokens_instagram enable row level security;
revoke all on table tokens_instagram from anon, authenticated;
do $$ begin
  if to_regclass('public.oauth_states') is not null then
    execute 'revoke all on table oauth_states from anon, authenticated';
  end if;
  if to_regclass('public.lista_aviso') is not null then
    execute 'revoke all on table lista_aviso from anon, authenticated';
  end if;
end $$;
