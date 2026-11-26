import { NextRequest, NextResponse } from "next/server";
import { supabaseDoUsuario, supabaseAdmin } from "@/lib/supabase";
import { trocarCodigo, contasDoToken, SemContaInstagram } from "@/lib/instagram";
import { cifrar } from "@/lib/crypto";
import { salvarConexao, ContaDeOutroCliente, COOKIE_PENDENTE, type Pendente } from "@/lib/conexao";

export async function GET(req: NextRequest) {
  const base = process.env.APP_URL!;
  const volta = (resultado: string) => NextResponse.redirect(`${base}/painel?ig=${resultado}`);

  const q = req.nextUrl.searchParams;
  if (q.get("error")) return volta("negado");

  const code = q.get("code");
  const state = q.get("state");
  if (!code || !state) return volta("erro");

  const db = supabaseAdmin();
  const { data: oauthState } = await db
    .from("oauth_states")
    .select("user_id, expires_at")
    .eq("state", state)
    .single();

  if (!oauthState || new Date(oauthState.expires_at) < new Date()) {
    console.error("callback → state inválido ou expirado:", state?.slice(0, 10));
    return volta("erro");
  }

  await db.from("oauth_states").delete().eq("state", state);

  const supabase = await supabaseDoUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== oauthState.user_id) return NextResponse.redirect(`${base}/login`);

  try {
    const cleanCode = code.replace(/#.*$/, "");
    const acesso = await trocarCodigo(cleanCode);
    const contas = await contasDoToken(acesso.token);
    if (!contas.length) throw new SemContaInstagram("Nenhuma conta do Instagram foi compartilhada");

    // Mais de uma conta no mesmo login: o cliente escolhe qual é a deste perfil (nunca pega a primeira sozinho)
    if (contas.length > 1) {
      const pendente: Pendente = { userId: user.id, token: acesso.token, expiraEm: acesso.expiraEm?.toISOString() ?? null, criadoEm: Date.now() };
      const res = NextResponse.redirect(`${base}/painel/escolher-instagram`);
      res.cookies.set(COOKIE_PENDENTE, cifrar(JSON.stringify(pendente)), {
        httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
      });
      return res;
    }

    await salvarConexao(user.id, acesso.token, acesso.expiraEm, contas[0]);
    return volta("ok");
  } catch (e) {
    if (e instanceof SemContaInstagram) return volta("sem-conta");
    if (e instanceof ContaDeOutroCliente) return volta("conta-de-outro");
    console.error("Erro no login do Instagram:", e);
    return volta("erro");
  }
}
