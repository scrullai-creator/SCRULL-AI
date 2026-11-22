-- Preços novos (22/11/2026):
-- Essencial: R$ 79,90/mês, 4 posts por semana.
-- Scrull: R$ 99,90/mês na promoção (de R$ 129,90), 1 post por dia. Premium: R$ 299,90, ainda escondido.
-- Quem já assina continua com o preço que assinou (só muda para as assinaturas novas).
update planos set preco_centavos = 7990, preco_cheio_centavos = null where id = 'basico';
update planos set preco_centavos = 9990, preco_cheio_centavos = 12990 where id = 'completo';
update planos set preco_centavos = 29990, preco_cheio_centavos = null, ativo = false where id = 'premium';
