-- Scrull AI: migração 3 — demonstração grátis sem Instagram conectado
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run

-- Na demo, os posts são criados antes de conectar o Instagram
alter table posts alter column conta_id drop not null;

-- As contas de teste que já existem (as suas) viram assinatura ativa,
-- para não ficarem presas à regra de "uma demo por conta"
update clientes set assinatura = 'ativa' where assinatura = 'teste';
