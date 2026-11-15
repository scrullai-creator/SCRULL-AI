-- Scrull AI: migração 5 — assinatura pelo Mercado Pago
alter table clientes add column if not exists mp_assinatura_id text;
notify pgrst, 'reload schema';
