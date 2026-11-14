-- Scrull AI: migração 4 — planos de lançamento
-- Essencial: R$ 99,90/mês, 4 posts por semana.
-- Scrull: R$ 129,90/mês (de R$ 199,90), 1 post por dia. Premium: R$ 299,00, em breve.
alter table planos add column if not exists preco_cheio_centavos int;
update planos set nome = 'Essencial', preco_centavos = 9990, preco_cheio_centavos = null, posts_por_semana = 4, ativo = true where id = 'basico';
update planos set nome = 'Scrull', preco_centavos = 12990, preco_cheio_centavos = 19990, posts_por_semana = 7, ativo = true where id = 'completo';
update planos set nome = 'Premium', preco_centavos = 29900, preco_cheio_centavos = null, posts_por_semana = 7, ativo = false where id = 'premium';
