// Publica um post no Instagram (API do Instagram com Login Unificado).
// Dois passos: cria o "container" com a imagem e a legenda, depois publica.
import { supabaseAdmin } from "./supabase";
import { decifrar } from "./crypto";

const GRAPH = "https://graph.facebook.com/v27.0";

async function meta(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || j.error) {
    const msg = j?.error?.error_user_msg ?? j?.error?.message ?? `Erro ${res.status}`;
    console.error("Instagram publicação erro:", res.status, j?.error?.code ?? "", j?.error?.error_subcode ?? "", msg);
    throw new Error(msg);
  }
  return j;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Vídeo (reels) que o Instagram ainda está processando: a fila termina na próxima rodada
export class VideoEmProcessamento extends Error {}

export async function publicarPost(postId: string, clienteId: string) {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts")
    .select("id, legenda, hashtags, imagem_url, video_url, ig_container_id, status, conta_id").eq("id", postId).eq("cliente_id", clienteId).single();
  if (!post) throw new Error("Post não encontrado");
  if (post.status === "publicado") throw new Error("Este post já foi publicado");
  if (!post.imagem_url && !post.video_url) throw new Error("Crie a arte antes de publicar");
  const ehVideo = !!post.video_url;

  // Conta do post ou, se ele foi criado antes de conectar, a conta ativa do cliente
  let contaId = post.conta_id as string | null;
  if (!contaId) {
    const { data: c } = await db.from("contas_instagram").select("id")
      .eq("cliente_id", clienteId).eq("ativa", true).limit(1).maybeSingle();
    contaId = c?.id ?? null;
  }
  if (!contaId) throw new Error("Conecte o Instagram antes de publicar");

  const [{ data: conta }, { data: tk }] = await Promise.all([
    db.from("contas_instagram").select("ig_user_id").eq("id", contaId).single(),
    db.from("tokens_instagram").select("token_cifrado").eq("conta_id", contaId).single(),
  ]);
  if (!conta || !tk) throw new Error("Conexão com o Instagram não encontrada. Conecte de novo.");
  const token = decifrar(tk.token_cifrado);
  const legenda = [post.legenda, (post.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n").slice(0, 2200);

  try {
    // 1) container (imagem ou reels). O de vídeo fica guardado: o Instagram pode levar minutos.
    let containerId = post.ig_container_id as string | null;
    if (!containerId) {
      const dados: Record<string, string> = ehVideo
        ? { media_type: "REELS", video_url: String(post.video_url), share_to_feed: "true", caption: legenda, access_token: token }
        : { image_url: String(post.imagem_url), caption: legenda, access_token: token };
      const container = await meta(`${GRAPH}/${conta.ig_user_id}/media`, { method: "POST", body: new URLSearchParams(dados) });
      containerId = String(container.id);
      if (ehVideo) await db.from("posts").update({ ig_container_id: containerId }).eq("id", postId);
    }
    // 2) espera o Instagram processar (vídeo: até ~40 s nesta rodada)
    let pronto = false;
    for (let i = 0; i < (ehVideo ? 13 : 10); i++) {
      const st = await meta(`${GRAPH}/${containerId}?${new URLSearchParams({ fields: "status_code", access_token: token })}`);
      if (st.status_code === "FINISHED") { pronto = true; break; }
      if (st.status_code === "ERROR" || st.status_code === "EXPIRED") {
        if (ehVideo) await db.from("posts").update({ ig_container_id: null }).eq("id", postId);
        throw new Error(ehVideo ? "O Instagram não conseguiu processar o vídeo (use MP4 ou MOV, na vertical, de 3 s a 8 s)" : "O Instagram não conseguiu processar a imagem");
      }
      await esperar(ehVideo ? 3000 : 2000);
    }
    if (!pronto && ehVideo) throw new VideoEmProcessamento("O Instagram ainda está processando o vídeo");
    const container = { id: containerId };
    // 3) publica
    const pub = await meta(`${GRAPH}/${conta.ig_user_id}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: container.id, access_token: token }),
    });
    await db.from("posts").update({ status: "publicado", ig_media_id: String(pub.id), erro_msg: null, conta_id: contaId, ig_container_id: null }).eq("id", postId);
    return String(pub.id);
  } catch (e: any) {
    if (e instanceof VideoEmProcessamento) throw e;
    await db.from("posts").update({ erro_msg: String(e?.message ?? e).slice(0, 300) }).eq("id", postId);
    throw e;
  }
}
