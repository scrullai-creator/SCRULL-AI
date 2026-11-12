import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Cliente "como o usuário logado": respeita as regras de segurança do banco.
export async function supabaseDoUsuario() {
  const jar = await cookies();
  return createServerClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista: { name: string; value: string; options?: any }[]) => {
        try {
          lista.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* chamado de um Server Component: pode ignorar */
        }
      },
    },
  });
}

// Cliente do servidor: acessa tudo (inclusive os tokens). Nunca use no navegador.
export function supabaseAdmin() {
  return createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
