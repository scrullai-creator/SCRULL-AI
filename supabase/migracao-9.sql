-- Scrull AI: migração 9 — publicar também na Página do Facebook
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run

-- Página do Facebook ligada ao Instagram do cliente (sem dados sensíveis)
alter table contas_instagram add column if not exists fb_page_id text;
alter table contas_instagram add column if not exists fb_page_nome text;

-- Token da Página: fica na tabela sem política de acesso (só o servidor lê), cifrado
alter table tokens_instagram add column if not exists fb_page_token_cifrado text;

-- O cliente escolhe se o post sai também no Facebook (ligado por padrão)
alter table configuracoes add column if not exists publicar_facebook boolean not null default true;

-- Resultado da publicação no Facebook
alter table posts add column if not exists fb_post_id text;
alter table posts add column if not exists fb_erro_msg text;

notify pgrst, 'reload schema';
