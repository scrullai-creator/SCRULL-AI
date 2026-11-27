// Publica um post no Instagram (API do Instagram com Login Unificado).
// Dois passos: cria o "container" com a imagem e a legenda, depois publica.
import { supabaseAdmin } from "./supabase";
import { decifrar } from "./crypto";
import { publicarNaPagina } from "./facebook";
import { registrar, type Quem } from "./historico";
import { situacaoDoTeste, TesteEncerrado, DIAS_GRATIS } from "./teste-gratis";

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

// O post já está indo ao ar (outra aba, outro clique ou a fila automática): não é erro do post
export class PostOcupado extends Error {}

// Estados de onde um post pode ir ao ar. "recusado" nunca sai; "publicado" e "publicando" já estão resolvidos.
const PODE_PUBLICAR = ["aguardando_aprovacao", "aprovado", "erro"];

// Um post só vira "publicado" depois que o Instagram devolve o id da publicação.
// Antes de começar, o post é travado como "publicando" (um único clique/rodada consegue a trava),
// e em qualquer falha volta como "erro" com o motivo, para o cliente tentar de novo com segurança.
export async function publicarPost(postId: string, clienteId: string, quem: Quem = "cliente") {
  const db = supabaseAdmin();
  const { data: post } = await db.from("posts")
    .select("id, legenda, hashtags, imagem_url, status, conta_id, ig_media_id, erro_msg").eq("id", postId).eq("cliente_id", clienteId).single();
  if (!post) throw new Error("Post não encontrado");
  if (post.status === "publicado") throw new PostOcupado("Este post já foi publicado");
  if (post.status === "publicando") throw new PostOcupado("Este post já está sendo publicado");
  if (!PODE_PUBLICAR.includes(post.status)) throw new Error("Post recusado: aprove antes de publicar");
  if (!post.imagem_url) throw new Error("Crie a arte antes de publicar");

  // Quem não assinou só publica dentro do teste grátis (DIAS_GRATIS posts por conta do Instagram)
  const { data: cli } = await db.from("clientes").select("assinatura").eq("id", clienteId).single();
  if (cli?.assinatura !== "ativa") {
    const teste = await situacaoDoTeste(clienteId);
    if (!teste.emTeste || teste.restam <= 0) {
      throw new TesteEncerrado(`Seu teste grátis de ${DIAS_GRATIS} dias terminou. Assine para a Scrull continuar publicando por você.`);
    }
  }

  // Trava: só um processo passa daqui. Sem a migração 11 (status "publicando" não existe), segue sem trava.
  const trava = await db.from("posts").update({ status: "publicando", publicando_desde: new Date().toISOString(), erro_msg: null })
    .eq("id", postId).eq("cliente_id", clienteId).in("status", PODE_PUBLICAR).select("id");
  const semMigracao = !!trava.error && /check|constraint|publicando_desde|column/i.test(trava.error.message);
  if (trava.error && !semMigracao) throw new Error(trava.error.message);
  if (!semMigracao && !trava.data?.length) throw new PostOcupado("Este post já está sendo publicado");
  await registrar(postId, clienteId, "publicando", null, quem);

  try {
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

    // Nova tentativa segura: se uma tentativa anterior chegou a sair no Instagram (e a resposta se perdeu),
    // encontra o post lá e só confirma, em vez de publicar de novo.
    let mediaId = post.ig_media_id as string | null;
    if (!mediaId && (post.status === "erro" || post.erro_msg)) mediaId = await acharNoInstagram(conta.ig_user_id, token, legenda);

    if (!mediaId) {
      // 1) container
      const container = await meta(`${GRAPH}/${conta.ig_user_id}/media`, {
        method: "POST",
        body: new URLSearchParams({ image_url: post.imagem_url, caption: legenda, access_token: token }),
      });
      // 2) espera o Instagram processar a imagem
      let pronto = false;
      for (let i = 0; i < 10; i++) {
        const st = await meta(`${GRAPH}/${container.id}?${new URLSearchParams({ fields: "status_code", access_token: token })}`);
        if (st.status_code === "FINISHED") { pronto = true; break; }
        if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new Error("O Instagram não conseguiu processar a imagem");
        await esperar(2000);
      }
      if (!pronto) throw new Error("O Instagram demorou para processar a imagem. Tente de novo em alguns minutos.");
      // 3) publica
      const pub = await meta(`${GRAPH}/${conta.ig_user_id}/media_publish`, {
        method: "POST",
        body: new URLSearchParams({ creation_id: container.id, access_token: token }),
      });
      mediaId = String(pub.id);
    }

    // 4) confirmação real: o Instagram informa o link e o horário em que o post saiu
    const conf = await meta(`${GRAPH}/${mediaId}?${new URLSearchParams({ fields: "permalink,timestamp", access_token: token })}`).catch(() => null);
    const publicadoEm = conf?.timestamp ? new Date(conf.timestamp).toISOString() : new Date().toISOString();
    const completo = { status: "publicado", ig_media_id: mediaId, erro_msg: null, conta_id: contaId,
      publicado_em: publicadoEm, ig_permalink: conf?.permalink ?? null, publicando_desde: null };
    const r = await db.from("posts").update(completo).eq("id", postId);
    if (r.error) {
      const { status, ig_media_id, erro_msg, conta_id } = completo;
      await db.from("posts").update({ status, ig_media_id, erro_msg, conta_id }).eq("id", postId);
    }
    await registrar(postId, clienteId, "publicado", conf?.permalink ?? null, quem);
    await publicarTambemNoFacebook(postId, clienteId, contaId, post.imagem_url, post.legenda, post.hashtags ?? []);
    return mediaId;
  } catch (e: any) {
    const motivo = String(e?.message ?? e).slice(0, 300);
    const r = await db.from("posts").update({ status: "erro", erro_msg: motivo, publicando_desde: null }).eq("id", postId);
    if (r.error) await db.from("posts").update({ status: "erro", erro_msg: motivo }).eq("id", postId);
    await registrar(postId, clienteId, "falhou", motivo, quem);
    throw e;
  }
}

// Procura entre os posts recentes do perfil um com a mesma legenda (saiu numa tentativa anterior)
async function acharNoInstagram(igUserId: string, token: string, legenda: string): Promise<string | null> {
  try {
    const j = await meta(`${GRAPH}/${igUserId}/media?${new URLSearchParams({ fields: "id,caption,timestamp", limit: "12", access_token: token })}`);
    const limpa = (t: string) => (t ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    const dia = Date.now() - 3 * 86400000;
    const achado = (j.data ?? []).find((m: any) => limpa(m.caption) === limpa(legenda) && new Date(m.timestamp).getTime() > dia);
    return achado ? String(achado.id) : null;
  } catch {
    return null;
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
