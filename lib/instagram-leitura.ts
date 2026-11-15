// Lê os posts recentes do Instagram do cliente para a IA aprender a voz da marca
// e o que já funciona (curtidas e comentários). Usado só na criação dos posts.
import { supabaseAdmin } from "./supabase";
import { decifrar } from "./crypto";

const GRAPH = "https://graph.facebook.com/v27.0";

export type PostDoPerfil = {
  legenda: string;
  tipo: string;
  curtidas: number;
  comentarios: number;
  data: string;
  imagem?: string;
};

export async function lerPerfil(clienteId: string): Promise<PostDoPerfil[]> {
  try {
    const db = supabaseAdmin();
    const { data: conta } = await db.from("contas_instagram").select("id, ig_user_id")
      .eq("cliente_id", clienteId).eq("ativa", true).limit(1).maybeSingle();
    if (!conta) return [];
    const { data: tk } = await db.from("tokens_instagram").select("token_cifrado").eq("conta_id", conta.id).single();
    if (!tk) return [];
    const p = new URLSearchParams({
      fields: "caption,media_type,media_url,thumbnail_url,like_count,comments_count,timestamp",
      limit: "24",
      access_token: decifrar(tk.token_cifrado),
    });
    const res = await fetch(`${GRAPH}/${conta.ig_user_id}/media?${p}`);
    if (!res.ok) {
      console.error("Leitura do perfil: erro", res.status);
      return [];
    }
    const j = await res.json();
    return (j.data ?? []).map((m: any) => ({
      legenda: String(m.caption ?? "").slice(0, 500),
      tipo: String(m.media_type ?? ""),
      curtidas: Number(m.like_count ?? 0),
      comentarios: Number(m.comments_count ?? 0),
      data: String(m.timestamp ?? "").slice(0, 10),
      imagem: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url,
    }));
  } catch (e) {
    console.error("Leitura do perfil falhou:", e);
    return [];
  }
}

// Resumo em texto para o prompt: os melhores primeiro, depois os mais recentes
export function resumoDoPerfil(posts: PostDoPerfil[]): string {
  if (!posts.length) return "(perfil ainda sem posts lidos)";
  const nota = (p: PostDoPerfil) => p.curtidas + 3 * p.comentarios;
  const melhores = [...posts].sort((a, b) => nota(b) - nota(a)).slice(0, 5);
  const linha = (p: PostDoPerfil) =>
    `- [${p.data}, ${p.tipo}, ${p.curtidas} curtidas, ${p.comentarios} comentários] ${p.legenda.replace(/\s+/g, " ").slice(0, 280) || "(sem legenda)"}`;
  return (
    `MELHORES POSTS (mais engajamento):\n${melhores.map(linha).join("\n")}\n\n` +
    `POSTS MAIS RECENTES:\n${posts.slice(0, 8).map(linha).join("\n")}`
  );
}
