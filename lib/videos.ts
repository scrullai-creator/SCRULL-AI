// Vídeos que o cliente envia (bastidores, produto, loja...). O Scrull guarda o vídeo,
// manda para a edição com IA (legendas e cortes, pelo Submagic) quando a chave estiver
// configurada, e transforma o vídeo em um reels com legenda escrita pela IA.
//
// O vídeo vai direto do celular para o Storage (upload assinado), porque passaria do
// limite de tamanho de uma server action na Vercel.
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "./supabase";
import { briefingParaPrompt, lerBriefing } from "./briefing";

const PASTA = "artes";
export const MAX_VIDEOS_MES = 4;           // por cliente, no plano Premium
export const MAX_SEGUNDOS = 8;             // reels curtinhos: até 8 segundos
export const MAX_MB = 50;                  // limite de arquivo do Storage no plano grátis do Supabase
export const TIPOS_VIDEO = ["video/mp4", "video/quicktime"];

export const edicaoConfigurada = () => !!process.env.SUBMAGIC_API_KEY;

// Quem pode usar vídeos: por enquanto, só a dona do app (fase de testes).
// Para liberar ao plano Premium depois, troque por:
//   return ehDono || (c?.plano_id === "premium" && c?.assinatura === "ativa");
export function podeUsarVideos(_c: { plano_id?: string | null; assinatura?: string | null } | null, ehDono: boolean) {
  return ehDono;
}

export async function videosDoMes(clienteId: string) {
  const inicio = new Date();
  inicio.setUTCDate(1); inicio.setUTCHours(3, 0, 0, 0); // dia 1, meia-noite em Brasília
  const { count } = await supabaseAdmin().from("videos").select("id", { count: "exact", head: true })
    .eq("cliente_id", clienteId).gte("criado_em", inicio.toISOString());
  return count ?? 0;
}

// 1) Endereço para o navegador enviar o arquivo direto ao Storage
export async function prepararEnvio(clienteId: string, extensao: "mp4" | "mov") {
  const caminho = `videos/${clienteId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${extensao}`;
  const { data, error } = await supabaseAdmin().storage.from(PASTA).createSignedUploadUrl(caminho);
  if (error || !data) throw new Error(error?.message ?? "Não foi possível preparar o envio");
  return { caminho, token: data.token };
}

// 2) Depois do envio: confere o arquivo, registra o vídeo e manda para a edição
export async function registrarVideo(clienteId: string, caminho: string, descricao: string, duracao: number) {
  if (!caminho.startsWith(`videos/${clienteId}/`) || caminho.includes("..")) throw new Error("Arquivo inválido");
  const db = supabaseAdmin();
  const pasta = caminho.slice(0, caminho.lastIndexOf("/"));
  const nome = caminho.slice(caminho.lastIndexOf("/") + 1);
  const { data: lista } = await db.storage.from(PASTA).list(pasta, { search: nome, limit: 1 });
  if (!lista?.length) throw new Error("O vídeo não chegou. Tente enviar de novo.");

  const url = db.storage.from(PASTA).getPublicUrl(caminho).data.publicUrl;
  const { data: video, error } = await db.from("videos").insert({
    cliente_id: clienteId, caminho, url_original: url,
    descricao: descricao.slice(0, 500) || null,
    duracao_s: Number.isFinite(duracao) && duracao > 0 ? Math.round(duracao) : null,
  }).select("id").single();
  if (error || !video) throw new Error(error?.message ?? "Não foi possível registrar o vídeo");

  if (edicaoConfigurada()) {
    await mandarParaEdicao(video.id).catch((e) => console.error("Edição de vídeo: falha ao iniciar", video.id, e?.message));
  }
  return video.id as string;
}

export async function apagarVideo(clienteId: string, videoId: string) {
  const db = supabaseAdmin();
  const { data: v } = await db.from("videos").select("caminho, post_id").eq("id", videoId).eq("cliente_id", clienteId).single();
  if (!v) return;
  if (v.post_id) throw new Error("Este vídeo já virou um reels. Recuse o post antes de apagar o vídeo.");
  await db.storage.from(PASTA).remove([v.caminho, `${v.caminho}.editado.mp4`]);
  await db.from("videos").delete().eq("id", videoId);
}

// Edição com IA (Submagic) --------------------------------------------------------
// O Submagic baixa o vídeo pela URL pública, transcreve, coloca legendas animadas,
// corta silêncios e avisa o Scrull pelo webhook quando o vídeo editado fica pronto.
const assinatura = (videoId: string) =>
  createHmac("sha256", process.env.CRON_SECRET ?? process.env.ENCRYPTION_KEY ?? "").update(`video:${videoId}`).digest("hex");

export function assinaturaValida(videoId: string, t: string) {
  const a = Buffer.from(assinatura(videoId)), b = Buffer.from(t ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function mandarParaEdicao(videoId: string) {
  const db = supabaseAdmin();
  const { data: v } = await db.from("videos").select("id, url_original, descricao, clientes(nome_empresa)").eq("id", videoId).single();
  if (!v) throw new Error("Vídeo não encontrado");
  const empresa = (v as any).clientes?.nome_empresa ?? "";
  const webhookUrl = `${process.env.APP_URL}/api/videos/editado?${new URLSearchParams({ v: v.id, t: assinatura(v.id) })}`;

  const res = await fetch("https://api.submagic.co/v1/projects", {
    method: "POST",
    headers: { "x-api-key": process.env.SUBMAGIC_API_KEY!, "content-type": "application/json" },
    body: JSON.stringify({
      title: (v.descricao || `Vídeo ${empresa}`).slice(0, 100),
      language: process.env.SUBMAGIC_LANGUAGE ?? "pt",
      videoUrl: v.url_original,
      templateName: process.env.SUBMAGIC_TEMPLATE ?? "Sara",
      removeSilencePace: "fast",
      magicZooms: true,
      webhookUrl,
      dictionary: empresa ? [empresa.slice(0, 50)] : undefined,
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.id) {
    const msg = j?.message ?? j?.error ?? `Erro ${res.status}`;
    await db.from("videos").update({ status: "erro", erro_msg: `Edição: ${String(msg).slice(0, 200)}` }).eq("id", videoId);
    throw new Error(String(msg));
  }
  await db.from("videos").update({ status: "editando", edicao_id: String(j.id), erro_msg: null }).eq("id", videoId);
}

// Chamado pelo webhook do Submagic. Copia o vídeo editado para o nosso Storage,
// porque o link do serviço de edição pode expirar antes de o reels ser publicado.
export async function receberEdicao(videoId: string, projetoId: string, status: string, urlBaixar: string | null) {
  const db = supabaseAdmin();
  const { data: v } = await db.from("videos").select("id, caminho, edicao_id").eq("id", videoId).single();
  if (!v || v.edicao_id !== projetoId) return false;
  if (status !== "completed" || !urlBaixar?.startsWith("https://")) {
    await db.from("videos").update({ status: "erro", erro_msg: "A edição do vídeo não deu certo. Você pode usar o vídeo original." }).eq("id", videoId);
    return true;
  }
  let urlFinal = urlBaixar;
  try {
    const r = await fetch(urlBaixar);
    if (r.ok) {
      const destino = `${v.caminho}.editado.mp4`;
      const { error } = await db.storage.from(PASTA).upload(destino, Buffer.from(await r.arrayBuffer()), { contentType: "video/mp4", upsert: true });
      if (!error) urlFinal = db.storage.from(PASTA).getPublicUrl(destino).data.publicUrl;
    }
  } catch (e: any) {
    console.error("Edição de vídeo: não copiei o vídeo editado, uso o link do Submagic", videoId, e?.message);
  }
  await db.from("videos").update({ status: "pronto", url_editado: urlFinal, erro_msg: null }).eq("id", videoId);
  return true;
}

// Reels: legenda escrita pela IA ----------------------------------------------------
const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";

async function legendaDoReels(c: { nome_empresa: string; ramo: string | null; tom_de_voz: string | null; briefing: unknown }, descricao: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODELO, max_tokens: 4000, output_config: { effort: "low" },
      system:
        "Você é a social media de uma agência brasileira que cuida do Instagram de pequenos negócios. " +
        "Escreve legendas de reels em português do Brasil, curtas, com calor e personalidade, sem clichês de IA. " +
        "Nunca inventa preços, endereços, telefones, prêmios ou depoimentos. Responde SOMENTE com JSON válido.",
      messages: [{
        role: "user",
        content:
          `EMPRESA: ${c.nome_empresa}\nRAMO: ${c.ramo ?? ""}\nTOM DE VOZ: ${c.tom_de_voz ?? ""}\n\n` +
          `BRIEFING:\n${briefingParaPrompt(lerBriefing(c.briefing))}\n\n` +
          `O cliente gravou um vídeo para um reels. Sobre o vídeo, ele disse: "${descricao || "(não descreveu)"}".\n\n` +
          `Escreva a legenda do reels: uma primeira linha que prende a atenção, 2 a 4 linhas curtas, ` +
          `e uma chamada para ação no final. Responda neste formato:\n` +
          `{"titulo": "até 6 palavras", "legenda": "...", "hashtags": ["#...", "... até 8"]}`,
      }],
    }),
  });
  if (!res.ok) throw new Error(`A IA respondeu com erro ${res.status}`);
  const j = await res.json();
  const texto: string = (j.content ?? []).map((b: any) => b.text ?? "").join("");
  const json = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
  return {
    titulo: String(json.titulo ?? "Reels").slice(0, 80),
    legenda: String(json.legenda ?? "").trim().slice(0, 2000),
    hashtags: (Array.isArray(json.hashtags) ? json.hashtags : [])
      .map((h: unknown) => String(h).trim().replace(/\s+/g, ""))
      .map((h: string) => (h.startsWith("#") ? h : `#${h}`)).filter((h: string) => h.length > 1).slice(0, 8),
  };
}

// Cria o post (reels) a partir de um vídeo: usa o editado se existir, senão o original.
export async function criarReels(clienteId: string, videoId: string) {
  const db = supabaseAdmin();
  const [{ data: v }, { data: c }, { data: cfg }, { data: conta }] = await Promise.all([
    db.from("videos").select("*").eq("id", videoId).eq("cliente_id", clienteId).single(),
    db.from("clientes").select("nome_empresa, ramo, tom_de_voz, briefing").eq("id", clienteId).single(),
    db.from("configuracoes").select("postar_sem_aprovacao").eq("cliente_id", clienteId).single(),
    db.from("contas_instagram").select("id").eq("cliente_id", clienteId).eq("ativa", true).limit(1).maybeSingle(),
  ]);
  if (!v || !c) throw new Error("Vídeo não encontrado");
  if (v.post_id) throw new Error("Este vídeo já virou um reels");
  if (v.status === "editando") throw new Error("O vídeo ainda está sendo editado");

  const texto = await legendaDoReels(c, v.descricao ?? "");
  // Sai amanhã às 18h (horário bom para reels); o cliente pode publicar antes pelo painel
  const amanha = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const { data: post, error } = await db.from("posts").insert({
    cliente_id: clienteId, conta_id: conta?.id ?? null, titulo_arte: texto.titulo, tema: "Reels",
    legenda: texto.legenda || v.descricao || "", hashtags: texto.hashtags,
    video_url: v.url_editado ?? v.url_original,
    agendado_para: new Date(`${amanha}T18:00:00-03:00`).toISOString(),
    status: cfg?.postar_sem_aprovacao ? "aprovado" : "aguardando_aprovacao",
  }).select("id").single();
  if (error || !post) throw new Error(error?.message ?? "Não foi possível criar o reels");
  await db.from("videos").update({ post_id: post.id }).eq("id", videoId);
  return post.id as string;
}
