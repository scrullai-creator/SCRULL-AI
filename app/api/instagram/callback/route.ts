import { NextRequest, NextResponse } from "next/server";
import { supabaseDoUsuario, supabaseAdmin } from "@/lib/supabase";
import { trocarCodigo, perfil, SemContaInstagram } from "@/lib/instagram";
import { cifrar } from "@/lib/crypto";
import { paginaDoFacebook } from "@/lib/facebook";

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
    const p = await perfil(acesso.token);

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
      token_cifrado: cifrar(acesso.token),
      // token de usuário do sistema não expira: guarda uma data bem distante
      expira_em: (acesso.expiraEm ?? new Date("2099-12-31T00:00:00Z")).toISOString(),
      atualizado_em: new Date().toISOString(),
    });
    if (erroToken) throw erroToken;

    // Extra: Página do Facebook ligada ao Instagram. Se não houver ou der erro,
    // o Instagram continua conectado normalmente.
    const pagina = await paginaDoFacebook(acesso.token, p.userId);
    if (pagina) {
      const [r1, r2] = await Promise.all([
        db.from("contas_instagram").update({ fb_page_id: pagina.id, fb_page_nome: pagina.nome }).eq("id", conta.id),
        db.from("tokens_instagram").update({ fb_page_token_cifrado: cifrar(pagina.token) }).eq("conta_id", conta.id),
      ]);
      if (r1.error || r2.error) console.error("Página do Facebook não foi salva:", r1.error?.message ?? r2.error?.message);
    } else {
      await db.from("contas_instagram").update({ fb_page_id: null, fb_page_nome: null }).eq("id", conta.id);
    }

    return volta("ok");
  } catch (e) {
    if (e instanceof SemContaInstagram) return volta("sem-conta");
    console.error("Erro no login do Instagram:", e);
    return volta("erro");
  }
}
