// Engajamento dos posts que o Scrull publicou: lê no Instagram 1 dia e 3 dias depois de cada post sair.
// Sem a permissão de insights (alcance, salvamentos...), guarda ao menos curtidas e comentários.
import { supabaseAdmin } from "./supabase";
import { decifrar } from "./crypto";

const GRAPH = "https://graph.facebook.com/v27.0";

export type Metricas = {
  alcance?: number; curtidas?: number; comentarios?: number; salvos?: number; compartilhamentos?: number;
  interacoes?: number; parcial?: boolean; lido_em: string;
};

async function lerUm(mediaId: string, token: string): Promise<Metricas> {
  const agora = new Date().toISOString();
  const base = await fetch(`${GRAPH}/${mediaId}?${new URLSearchParams({ fields: "like_count,comments_count", access_token: token })}`)
    .then((r) => r.json()).catch(() => null);
  const m: Metricas = { curtidas: Number(base?.like_count ?? 0), comentarios: Number(base?.comments_count ?? 0), lido_em: agora };
  const ins = await fetch(`${GRAPH}/${mediaId}/insights?${new URLSearchParams({ metric: "reach,saved,shares,total_interactions", access_token: token })}`)
    .then((r) => r.json()).catch(() => null);
  if (!ins || ins.error || !Array.isArray(ins.data)) {
    if (ins?.error) console.log("Métricas: sem insights (permissão?)", ins.error.code ?? "", ins.error.message ?? "");
    return { ...m, parcial: true };
  }
  const v = (nome: string) => Number(ins.data.find((d: any) => d.name === nome)?.values?.[0]?.value ?? 0);
  return { ...m, alcance: v("reach"), salvos: v("saved"), compartilhamentos: v("shares"), interacoes: v("total_interactions") };
}

// Lê os posts que estão no ponto (1 dia ou 3 dias depois de publicados). Devolve quantos leu.
export async function atualizarMetricas(limite = 10): Promise<number> {
  const db = supabaseAdmin();
  const agora = Date.now();
  const { data: posts, error } = await db.from("posts")
    .select("id, cliente_id, conta_id, ig_media_id, publicado_em, metricas_em")
    .eq("status", "publicado").not("ig_media_id", "is", null)
    .lte("publicado_em", new Date(agora - 24 * 3600000).toISOString())
    .gte("publicado_em", new Date(agora - 10 * 86400000).toISOString())
    .order("publicado_em", { ascending: false }).limit(60);
  if (error) return 0; // sem a migração 12, não faz nada
  const devidos = (posts ?? []).filter((p) => {
    if (!p.metricas_em) return true;                                     // 1ª leitura (1 dia depois)
    const pub = new Date(p.publicado_em).getTime(), lido = new Date(p.metricas_em).getTime();
    return agora - pub >= 3 * 86400000 && lido - pub < 3 * 86400000;     // 2ª leitura (3 dias depois)
  }).slice(0, limite);
  const tokens = new Map<string, string | null>();
  let n = 0;
  for (const p of devidos) {
    if (!p.conta_id) continue;
    if (!tokens.has(p.conta_id)) {
      const { data: tk } = await db.from("tokens_instagram").select("token_cifrado").eq("conta_id", p.conta_id).maybeSingle();
      tokens.set(p.conta_id, tk ? decifrar(tk.token_cifrado) : null);
    }
    const token = tokens.get(p.conta_id);
    if (!token) continue;
    try {
      const m = await lerUm(p.ig_media_id!, token);
      await db.from("posts").update({ metricas: m, metricas_em: m.lido_em }).eq("id", p.id);
      n++;
    } catch (e) {
      console.error("Métricas: falhou", p.id, e instanceof Error ? e.message : e);
    }
  }
  return n;
}
