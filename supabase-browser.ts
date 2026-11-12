import { createBrowserClient } from "@supabase/ssr";

// Cliente para telas que rodam no navegador (login e cadastro)
export const supabaseNavegador = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
