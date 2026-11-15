-- Scrull AI: migração 6 — modelos de arte variados
alter table posts add column if not exists layout text;
alter table posts add column if not exists subtitulo text;
notify pgrst, 'reload schema';
