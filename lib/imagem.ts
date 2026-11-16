// Gera a arte do post com a API de imagens da OpenAI e guarda no Supabase Storage.
// A descrição (prompt) vem do Claude; se o cliente tiver logo, ela vai junto como
// referência para aparecer igual em todas as artes.
import { supabaseAdmin } from "./supabase";
import { montarArte, corDaMarca } from "./arte";
import { lerBriefing } from "./briefing";
import { listarFotos, prepararFoto } from "./fotos";

const MODELO = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5";
const QUALIDADE = process.env.OPENAI_IMAGE_QUALITY ?? "medium"; // low | medium | high
const PASTA = "artes";

async function lerErro(res: Response) {
  const j = await res.json().catch(() => null);
  console.error("OpenAI imagens erro:", res.status, j?.error?.type ?? "", j?.error?.message ?? "");
  throw new Error(j?.error?.message ?? `A geração de imagem respondeu com erro ${res.status}`);
}

// Gera só a FOTO de fundo (sem texto nenhum): o título e a logo são escritos pelo app
export async function gerarFoto(cena: string): Promise<Buffer> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new Error("OPENAI_API_KEY não configurada");
  const prompt =
    `${cena} Photorealistic, professional photography, soft natural light, shallow depth of field. ` +
    `Composition: keep the lower-left third of the frame simple and uncluttered (it will receive text later). ` +
    `Absolutely no text, letters, numbers, logos, watermarks or captions anywhere in the image.`;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODELO, prompt, size: "1024x1024", quality: QUALIDADE,
      output_format: "jpeg", output_compression: 90, n: 1,
    }),
  });
  if (!res.ok) await lerErro(res);
  const j = await res.json();
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error("A geração de imagem não devolveu a foto");
  if (j.usage) console.log("OpenAI imagens uso:", JSON.stringify(j.usage));
  return Buffer.from(b64, "base64");
}

// Grava um arquivo na pasta pública e devolve a URL
export async function guardarArquivo(caminho: string, bytes: Buffer | ArrayBuffer, contentType: string) {
  const db = supabaseAdmin();
  const { error } = await db.storage.from(PASTA).upload(caminho, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Erro ao guardar o arquivo: ${error.message}`);
  const { data } = db.storage.from(PASTA).getPublicUrl(caminho);
  return data.publicUrl;
}

// Limites de geração, para o cliente não gastar o saldo de imagens sem querer:
// até 3 artes por post e, por mês, 2 artes por post previsto no plano.
export const ARTES_POR_POST = Number(process.env.LIMITE_ARTES_POR_POST ?? 3);
const ARTES_POR_POST_NO_MES = 2;
// Quem ainda não assinou (demonstração) pode criar só estas artes, no total
export const ARTES_DEMO = Number(process.env.LIMITE_ARTES_DEMO ?? 2);

export class LimiteDeArtes extends Error {}

// Conta as artes já geradas olhando os arquivos guardados (nome: <post>-<data>.jpg)
export async function contarArtes(clienteId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db.storage.from(PASTA).list(clienteId, { limit: 1000 });
  if (error) throw new Error(`Erro ao listar as artes: ${error.message}`);
  const umMesAtras = Date.now() - 30 * 86400000;
  const artes = (data ?? []).filter((f) => !f.name.startsWith("logo."));
  const porPost: Record<string, number> = {};
  let noMes = 0;
  for (const f of artes) {
    const postId = f.name.replace(/-\d+\.jpg$/, "");
    porPost[postId] = (porPost[postId] ?? 0) + 1;
    if (new Date(f.created_at ?? 0).getTime() >= umMesAtras) noMes++;
  }
  return { porPost, noMes };
}

// Gera a arte de um post e salva a URL nele
export async function gerarArteDoPost(postId: string, clienteId: string) {
  const db = supabaseAdmin();
  const [{ data: post }, { data: cliente }, contagem] = await Promise.all([
    db.from("posts").select("id, prompt_imagem, titulo_arte, topicos, layout, subtitulo").eq("id", postId).eq("cliente_id", clienteId).single(),
    db.from("clientes").select("logo_url, nome_empresa, assinatura, briefing, planos(posts_por_semana)").eq("id", clienteId).single(),
    contarArtes(clienteId),
  ]);
  if (!post) throw new Error("Post não encontrado");

  if (cliente?.assinatura !== "ativa" && contagem.noMes >= ARTES_DEMO) {
    throw new LimiteDeArtes(`A demonstração inclui ${ARTES_DEMO} artes`);
  }
  const porSemana = (cliente as any)?.planos?.posts_por_semana ?? 7;
  const limiteMes = porSemana * 4 * ARTES_POR_POST_NO_MES;
  if ((contagem.porPost[postId] ?? 0) >= ARTES_POR_POST) {
    throw new LimiteDeArtes(`Este post já tem ${ARTES_POR_POST} artes geradas`);
  }
  if (contagem.noMes >= limiteMes) {
    throw new LimiteDeArtes(`Limite de ${limiteMes} artes por mês atingido`);
  }

  // O próprio Scrull (@scrull.ai) tem identidade fixa: roxo escuro com neon e o mascote
  const ehScrull = /scrull/i.test(cliente?.nome_empresa ?? "");
  const cena = (post.prompt_imagem || "A clean, modern workspace of a small business owner, warm tones.") +
    (ehScrull ? " Deep dark purple and violet neon lighting, night mood, modern. No food, no pizza, no robots." : "");
  // Se o cliente enviou fotos, as primeiras artes de cada post usam essas fotos reais (sem custo de IA);
  // as trocas seguintes passam para as outras fotos e, acabando elas, para uma foto gerada.
  const fotosDoCliente = await listarFotos(clienteId).catch(() => []);
  const usadas = contagem.porPost[postId] ?? 0;
  const gancho = [...postId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const escolhida = fotosDoCliente.length > 0 && usadas < fotosDoCliente.length
    ? await prepararFoto(fotosDoCliente[(gancho + usadas) % fotosDoCliente.length].url) : null;
  const [foto, logo, mascote] = await Promise.all([
    // O Scrull não usa as fotos enviadas: a arte dele é sempre gerada no visual da marca
    (ehScrull ? null : escolhida) ?? gerarFoto(cena),
    lerLogo(cliente?.logo_url),
    ehScrull ? lerMascote() : Promise.resolve(null),
  ]);
  const bytes = await montarArte({
    fundoJpeg: foto, titulo: post.titulo_arte ?? cliente?.nome_empresa ?? "", topicos: post.topicos ?? [],
    layout: escolherLayout(post.layout, gancho, usadas), subtitulo: post.subtitulo ?? "",
    logo, nomeEmpresa: cliente?.nome_empresa ?? "", mascote,
    cor: ehScrull ? "#3b0764" : corDaMarca(lerBriefing(cliente?.briefing).cores),
  });
  const url = await guardarArquivo(`${clienteId}/${postId}-${Date.now()}.jpg`, bytes, "image/jpeg");

  const { error } = await db.from("posts").update({ imagem_url: url }).eq("id", postId);
  if (error) throw error;
  return url;
}

// Formato da arte: o que a IA escolheu para o post (ou um sorteado pelo id, para posts antigos
// sem formato salvo). A cada troca de arte passa para o formato seguinte, para variar de verdade.
const FORMATOS = ["faixa", "centro", "cartao", "frase"] as const;
function escolherLayout(salvo: string | null | undefined, gancho: number, trocas: number) {
  const i = FORMATOS.indexOf(salvo as any);
  const base = i >= 0 ? i : gancho % FORMATOS.length;
  return FORMATOS[(base + trocas) % FORMATOS.length];
}

async function lerMascote() {
  const res = await fetch(`${process.env.APP_URL}/mascote.png`).catch(() => null);
  return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

async function lerLogo(url?: string | null) {
  if (!url) return null;
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return null;
  return { bytes: Buffer.from(await res.arrayBuffer()), tipo: res.headers.get("content-type") ?? "image/png" };
}
