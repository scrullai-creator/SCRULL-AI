import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  // Só aceita caminhos do próprio site (evita mandar a pessoa para outro endereço)
  const pedido = searchParams.get("next") ?? "/painel";
  const next = /^\/[a-z0-9\-_/]*$/i.test(pedido) && !pedido.startsWith("//") ? pedido : "/painel";
  const base = process.env.APP_URL!;

  if (code) {
    const jar = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => jar.getAll(),
          setAll: (lista: { name: string; value: string; options?: object }[]) => {
            try {
              lista.forEach(({ name, value, options }) => jar.set(name, value, options as any));
            } catch {}
          },
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${next}`);
  }

  return NextResponse.redirect(`${base}/login?erro=${next === "/nova-senha" ? "link" : "confirmacao"}`);
}
