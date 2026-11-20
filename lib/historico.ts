// Histórico de cada post: quem fez o quê e quando (aprovar, recusar, trocar arte, publicar...).
// Nunca atrapalha a ação principal: se a migração 11 não rodou ou der erro, só não registra.
import { supabaseAdmin } from "./supabase";

export type Quem = "cliente" | "dono" | "automático";

export async function registrar(postIds: string | string[], clienteId: string, acao: string, detalhe?: string | null, quem: Quem = "cliente") {
  const ids = Array.isArray(postIds) ? postIds : [postIds];
  if (!ids.length) return;
  const { error } = await supabaseAdmin().from("post_historico").insert(
    ids.map((post_id) => ({ post_id, cliente_id: clienteId, acao, detalhe: detalhe ? detalhe.slice(0, 300) : null, quem }))
  );
  if (error) console.error("Histórico: não registrou", acao, error.message);
}
