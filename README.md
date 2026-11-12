# Scrull AI

## Para rodar no seu computador
1. Instale o Node.js (nodejs.org, versão LTS).
2. Na pasta do projeto: `npm install`
3. Copie `.env.example` para `.env.local` e preencha as chaves.
4. No Supabase: SQL Editor, cole o `supabase/schema.sql` e clique em Run.
5. No Supabase, em Authentication > Providers > Email, desligue "Confirm email" enquanto estiver testando.
6. `npm run dev` e abra http://localhost:3000

## Para colocar no ar
Envie a pasta para o GitHub e importe o projeto na Vercel. Cadastre as mesmas chaves do `.env.local` em Settings > Environment Variables.
