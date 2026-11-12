import { NextRequest, NextResponse } from "next/server";
import { supabaseDoUsuario, supabaseAdmin } from "@/lib/supabase";
import { trocarCodigo, tokenLongo, perfil } from "@/lib/instagram";
import { cifrar } from "@/lib/crypto";

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
    const curto = await trocarCodigo(cleanCode);
    const longo = await tokenLongo(curto.token);
    const p = await perfil(longo.token);

    if (!["BUSINESS", "MEDIA_CREATOR"].includes(p.tipo)) return volta("conta-pessoal");

    const { data: conta, error } = await db
      .from("contas_instagram")
      .upsert(
        { cliente_id: user.id, ig_user_id: p.userId, ig_username: p.username, ativa: true },
        { onConflict: "cliente_id,ig_user_id" }
      )
      .select("id")
      .single();
    if (error) throw error;

    const { error: erroToken } = await db.from("tokens_instagram").upsert({
      conta_id: conta.id,
      token_cifrado: cifrar(longo.token),
      expira_em: longo.expiraEm.toISOString(),
      atualizado_em: new Date().toISOString(),
    });
    if (erroToken) throw erroToken;

    return volta("ok");
  } catch (e) {
    console.error("Erro no login do Instagram:", e);
    return volta("erro");
  }
}
