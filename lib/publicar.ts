// Publica um post no Instagram (API do Instagram com Login Unificado).
// Dois passos: cria o "container" com a imagem e a legenda, depois publica.
import { supabaseAdmin } from "./supabase";
import { decifrar } from "./crypto";
import { publicarNaPagina } from "./facebook";

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

export async function publicarPost(postId: string, clienteId: string) {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts")
    .select("id, legenda, hashtags, imagem_url, status, conta_id").eq("id", postId).eq("cliente_id", clienteId).single();
  if (!post) throw new Error("Post não encontrado");
  if (post.status === "publicado") throw new Error("Este post já foi publicado");
  if (!post.imagem_url) throw new Error("Crie a arte antes de publicar");

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
    // 1) container
    const container = await meta(`${GRAPH}/${conta.ig_user_id}/media`, {
      method: "POST",
      body: new URLSearchParams({ image_url: post.imagem_url, caption: legenda, access_token: token }),
    });
    // 2) espera o Instagram processar a imagem
    for (let i = 0; i < 10; i++) {
      const st = await meta(`${GRAPH}/${container.id}?${new URLSearchParams({ fields: "status_code", access_token: token })}`);
      if (st.status_code === "FINISHED") break;
      if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new Error("O Instagram não conseguiu processar a imagem");
      await esperar(2000);
    }
    // 3) publica
    const pub = await meta(`${GRAPH}/${conta.ig_user_id}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: container.id, access_token: token }),
    });
    await db.from("posts").update({ status: "publicado", ig_media_id: String(pub.id), erro_msg: null, conta_id: contaId }).eq("id", postId);
    await publicarTambemNoFacebook(postId, clienteId, contaId, post.imagem_url, post.legenda, post.hashtags ?? []);
    return String(pub.id);
  } catch (e: any) {
    await db.from("posts").update({ erro_msg: String(e?.message ?? e).slice(0, 300) }).eq("id", postId);
    throw e;
  }
}

// Depois que o post sai no Instagram, sai também na Página do Facebook (se houver
// Página conectada e o cliente não tiver desligado). Nunca derruba o Instagram:
// qualquer falha fica só em fb_erro_msg.
async function publicarTambemNoFacebook(
  postId: string, clienteId: string, contaId: string, imagemUrl: string, legenda: string, hashtags: string[]
) {
  const db = supabaseAdmin();
  try {
    const [{ data: cfg }, { data: conta }, { data: tk }, { data: post }] = await Promise.all([
      db.from("configuracoes").select("publicar_facebook").eq("cliente_id", clienteId).single(),
      db.from("contas_instagram").select("fb_page_id").eq("id", contaId).single(),
      db.from("tokens_instagram").select("fb_page_token_cifrado").eq("conta_id", contaId).single(),
      db.from("posts").select("fb_post_id").eq("id", postId).single(),
    ]);
    // Sem a migração 9, sem Página ou desligado pelo cliente: não faz nada
    if (!cfg || cfg.publicar_facebook === false) return;
    if (!conta?.fb_page_id || !tk?.fb_page_token_cifrado) return;
    if (post?.fb_post_id) return; // já saiu no Facebook

    // No Facebook, poucas hashtags funcionam melhor
    const texto = [legenda, hashtags.slice(0, 5).join(" ")].filter(Boolean).join("\n\n").slice(0, 5000);
    const fbId = await publicarNaPagina(conta.fb_page_id, decifrar(tk.fb_page_token_cifrado), imagemUrl, texto);
    await db.from("posts").update({ fb_post_id: fbId, fb_erro_msg: null }).eq("id", postId);
  } catch (e: any) {
    await db.from("posts").update({ fb_erro_msg: `Facebook: ${String(e?.message ?? e)}`.slice(0, 300) }).eq("id", postId);
  }
}
