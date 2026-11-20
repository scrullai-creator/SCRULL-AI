-- Scrull AI: migração 10 — memória visual por cliente
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run

-- Como cada arte foi feita (segmento, estilo, enquadramento, layout, origem, nota da revisão
-- e a "impressão digital" da imagem). A próxima arte do mesmo cliente evita repetir.
alter table posts add column if not exists visual jsonb;

notify pgrst, 'reload schema';
