// Gera a arte do post com a API de imagens da OpenAI e guarda no Supabase Storage.
// A descrição (prompt) vem do Claude; se o cliente tiver logo, ela vai junto como
// referência para aparecer igual em todas as artes.
import { supabaseAdmin } from "./supabase";
import { montarArte, corDaMarca, fonteDoRamo } from "./arte";
import { montarArteScrull, modeloScrull, LUZ_SEM } from "./arte-scrull";
import { criarArteCompleta, aplicarLogo, revisarFoto } from "./arte-ia";
import { segmentoDoRamo, escolherDirecao, impressaoDigital, parecidaDemais, type Visual } from "./direcao-arte";
import sharp from "sharp";
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

// Artes por mês no plano: 2 por post previsto (ex.: 7 posts por semana = 56 artes em 30 dias)
export const limiteMensal = (postsPorSemana?: number | null) => (postsPorSemana ?? 7) * 4 * ARTES_POR_POST_NO_MES;

// Conta as artes já geradas olhando os arquivos guardados (nome: <post>-<data>.jpg)
export async function contarArtes(clienteId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db.storage.from(PASTA).list(clienteId, { limit: 1000 });
  if (error) throw new Error(`Erro ao listar as artes: ${error.message}`);
  const umMesAtras = Date.now() - 30 * 86400000;
  const artes = (data ?? []).filter((f) => !f.name.startsWith("logo."));
  const porPost: Record<string, number> = {};
  let noMes = 0;
  let maisAntiga: number | null = null; // a arte mais antiga dentro dos últimos 30 dias
  for (const f of artes) {
    const postId = f.name.replace(/-\d+\.jpg$/, "");
    porPost[postId] = (porPost[postId] ?? 0) + 1;
    const t = new Date(f.created_at ?? 0).getTime();
    if (t >= umMesAtras) { noMes++; if (maisAntiga === null || t < maisAntiga) maisAntiga = t; }
  }
  // O limite mensal conta os últimos 30 dias: a próxima vaga abre quando a arte mais antiga completa 30 dias
  const proximaVaga = maisAntiga !== null ? new Date(maisAntiga + 30 * 86400000).toISOString() : null;
  return { porPost, noMes, proximaVaga };
}

// Gera a arte de um post e salva a URL nele
export async function gerarArteDoPost(postId: string, clienteId: string) {
  const inicio = Date.now();
  const db = supabaseAdmin();
  const [{ data: post }, { data: cliente }, contagem] = await Promise.all([
    db.from("posts").select("id, prompt_imagem, titulo_arte, topicos, layout, subtitulo, agendado_para").eq("id", postId).eq("cliente_id", clienteId).single(),
    db.from("clientes").select("logo_url, nome_empresa, ramo, assinatura, briefing, planos(posts_por_semana)").eq("id", clienteId).single(),
    contarArtes(clienteId),
  ]);
  if (!post) throw new Error("Post não encontrado");

  if (cliente?.assinatura !== "ativa" && contagem.noMes >= ARTES_DEMO) {
    throw new LimiteDeArtes(`A demonstração inclui ${ARTES_DEMO} artes`);
  }
  const limiteMes = limiteMensal((cliente as any)?.planos?.posts_por_semana);
  if ((contagem.porPost[postId] ?? 0) >= ARTES_POR_POST) {
    throw new LimiteDeArtes(`Este post já tem ${ARTES_POR_POST} artes geradas`);
  }
  if (contagem.noMes >= limiteMes) {
    throw new LimiteDeArtes(`Limite de ${limiteMes} artes por mês atingido`);
  }

  const usadas = contagem.porPost[postId] ?? 0;
  const gancho = [...postId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const cena = post.prompt_imagem || "A clean, modern photo of a small business, natural tones.";
  let bytes: Buffer;

  const ehScrull = /scrull/i.test(cliente?.nome_empresa ?? "");
  const briefing = lerBriefing(cliente?.briefing);
  const titulo = post.titulo_arte ?? cliente?.nome_empresa ?? "";
  // Fotos reais enviadas pelo cliente: as primeiras artes de cada post usam essas fotos;
  // as trocas seguintes passam para as outras e, acabando elas, para uma foto criada pela IA.
  const fotosDoCliente = ehScrull ? [] : await listarFotos(clienteId).catch(() => []);
  const escolhida = fotosDoCliente.length > 0 && usadas < fotosDoCliente.length
    ? await prepararFoto(fotosDoCliente[(gancho + usadas) % fotosDoCliente.length].url) : null;
  const logo = ehScrull ? null : await lerLogo(cliente?.logo_url);
  const corHex = briefing.cores ? corDaMarca(briefing.cores) : (await corDaLogo(logo)) ?? null;

  // Memória visual DESTE cliente: a próxima arte evita o estilo, o ângulo e a composição usados por último
  const memoria = await lerMemoria(clienteId, postId);
  const segmento = ehScrull ? "tecnologia" : segmentoDoRamo(cliente?.ramo ?? "");
  const direcao = escolherDirecao(segmento, memoria, gancho, usadas, ehScrull);
  const visual: Visual = { segmento, estilo: direcao.estilo, enquadramento: direcao.enquadramento, layout: post.layout };

  // Arte completa pela IA (foto + texto + composição numa peça só, revisada pelo Claude).
  // Por enquanto ligada só no próprio Scrull; ARTE_IA_TODOS=1 liga para todos os clientes.
  let pronta: Buffer | null = null;
  if (ehScrull || process.env.ARTE_IA_TODOS === "1") {
    try {
      const mascote = ehScrull ? await lerMascote() : null;
      const { arte, revisao } = await criarArteCompleta({
        empresa: cliente?.nome_empresa ?? "", ramo: ehScrull ? "app que cria e posta no Instagram de pequenos negócios" : (cliente?.ramo ?? ""),
        estilo: direcao.textoEstilo,
        cores: ehScrull ? "violet #7c3aed, electric blue #2563eb, cyan #06b6d4, white; vary the mix per post"
          : [briefing.cores, corHex].filter(Boolean).join(" / "),
        titulo, subtitulo: post.subtitulo ?? "", topicos: post.layout === "faixa" ? post.topicos ?? [] : [],
        cena: cena + " " + direcao.textoEnquadramento + (ehScrull ? " Small business context, no food, no pizza." : ""),
        referencias: [
          ...(escolhida ? [{ bytes: escolhida, tipo: "produto" as const }] : []),
          ...(mascote ? [{ bytes: mascote, tipo: "mascote" as const }] : []),
        ],
        reservarCantoLogo: !!logo,
        assinatura: ehScrull ? "@scrull.ai" : undefined,
      }, 80_000);
      pronta = await aplicarLogo(arte, logo);
      visual.origem = "ia-completa";
      visual.nota = revisao.nota;
      visual.hash = await impressaoDigital(arte);
    } catch (e: any) {
      console.error("Arte IA falhou; usando o modelo de arte:", e?.message);
    }
  }

  if (pronta) {
    bytes = pronta;
  } else if (ehScrull) {
    // Plano B do Scrull: modelos de tecnologia montados pelo app
    const modelo = modeloScrull(post.agendado_para, usadas);
    const [foto, mascote] = await Promise.all([gerarFoto(cena + modelo.luz + LUZ_SEM), lerMascote()]);
    bytes = await montarArteScrull(modelo, {
      fotoJpeg: foto, titulo: titulo || "Scrull AI", subtitulo: post.subtitulo ?? "", topicos: post.topicos ?? [], mascote,
    });
  } else {
    // Clientes: cada um com a própria identidade (cores do briefing ou da logo, fonte pelo ramo,
    // fotos reais que ele enviou). Nada do Scrull e nada de outro cliente entra aqui.
    let foto: Buffer;
    if (escolhida) {
      foto = escolhida;
      visual.origem = "foto-cliente";
    } else {
      foto = await fotoRevisada(cena + " " + direcao.textoEnquadramento, cliente?.nome_empresa ?? "", cliente?.ramo ?? "", memoria, inicio, visual,
        [titulo, post.subtitulo].filter(Boolean).join(" — "));
      visual.origem = "modelo";
    }
    visual.hash ??= await impressaoDigital(foto);
    visual.layout = escolherLayout(post.layout, gancho, usadas);
    bytes = await montarArte({
      fundoJpeg: foto, titulo, topicos: post.topicos ?? [],
      layout: escolherLayout(post.layout, gancho, usadas), subtitulo: post.subtitulo ?? "",
      logo, nomeEmpresa: cliente?.nome_empresa ?? "",
      cor: corHex ?? corDaMarca(""),
      fonteTitulo: fonteDoRamo(cliente?.ramo ?? "", clienteId),
    });
  }
  const url = await guardarArquivo(`${clienteId}/${postId}-${Date.now()}.jpg`, bytes, "image/jpeg");

  let { error } = await db.from("posts").update({ imagem_url: url, visual }).eq("id", postId);
  // Se a migração 10 ainda não rodou (coluna "visual" não existe), salva só a arte
  if (error && /visual/i.test(error.message)) ({ error } = await db.from("posts").update({ imagem_url: url }).eq("id", postId));
  if (error) throw error;
  return url;
}

// Últimas artes deste cliente (a arte anterior deste mesmo post vem primeiro). Sem a coluna, memória vazia.
async function lerMemoria(clienteId: string, postId: string): Promise<Visual[]> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("posts").select("id, visual")
    .eq("cliente_id", clienteId).not("visual", "is", null)
    .order("agendado_para", { ascending: false }).limit(8);
  if (error || !data) return [];
  const deste = data.filter((p) => p.id === postId);
  return [...deste, ...data.filter((p) => p.id !== postId)].map((p) => p.visual as Visual);
}

// Foto criada pela IA para o modelo do app: o Claude revisa (nitidez, proporção, enquadramento, apelo)
// e a memória confere se não ficou parecida demais com uma arte recente. Se reprovar e ainda houver
// tempo, refaz UMA vez com as correções (para não gastar o saldo) e fica com a melhor das duas.
async function fotoRevisada(cena: string, empresa: string, ramo: string, memoria: Visual[], inicio: number, visual: Visual, mensagem = "") {
  const foto = await gerarFoto(cena);
  const [rev, hash] = await Promise.all([revisarFoto(foto, empresa, ramo, mensagem), impressaoDigital(foto)]);
  const repetida = parecidaDemais(hash, memoria);
  console.log("Foto revisão:", empresa, rev.nota, rev.aprovada ? "aprovada" : `reprovada: ${rev.problemas}`, repetida ? "(parecida com arte recente)" : "");
  visual.nota = rev.nota; visual.hash = hash;
  if ((rev.aprovada && !repetida) || Date.now() - inicio > 22_000) return foto;

  const correcoes = [rev.aprovada ? "" : rev.problemas,
    repetida ? "Too similar to a recent post: use a clearly different camera angle, setting and color mood." : ""].filter(Boolean).join(" ");
  const nova = await gerarFoto(`${cena} FIX THESE PROBLEMS: ${correcoes}`);
  const [rev2, hash2] = await Promise.all([revisarFoto(nova, empresa, ramo, mensagem), impressaoDigital(nova)]);
  console.log("Foto revisão (2ª):", empresa, rev2.nota, rev2.aprovada ? "aprovada" : `reprovada: ${rev2.problemas}`);
  if (rev2.nota >= rev.nota || repetida) { visual.nota = rev2.nota; visual.hash = hash2; return nova; }
  return foto;
}

// Formato da arte: o que a IA escolheu para o post (ou um sorteado pelo id, para posts antigos
// sem formato salvo). A cada troca de arte passa para o formato seguinte, para variar de verdade.
const FORMATOS = ["faixa", "centro", "cartao", "frase"] as const;
function escolherLayout(salvo: string | null | undefined, gancho: number, trocas: number) {
  const i = FORMATOS.indexOf(salvo as any);
  const base = i >= 0 ? i : gancho % FORMATOS.length;
  return FORMATOS[(base + trocas) % FORMATOS.length];
}

// Cor de destaque tirada da logo, quando o briefing não diz as cores da marca.
// Ignora tons quase brancos ou quase pretos e escurece um pouco para o texto branco ficar legível.
async function corDaLogo(logo: { bytes: Buffer } | null): Promise<string | null> {
  if (!logo) return null;
  try {
    const { data } = await sharp(logo.bytes).flatten({ background: "#ffffff" }).resize(48, 48, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
    let melhor: [number, number, number] | null = null; let maior = 0;
    for (let i = 0; i < data.length; i += 3) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (max < 40 || (max > 235 && sat < 0.1)) continue;
      if (sat > maior) { maior = sat; melhor = [r, g, b]; }
    }
    if (!melhor || maior < 0.25) return null;
    const k = 0.78;
    return "#" + melhor.map((v) => Math.round(v * k).toString(16).padStart(2, "0")).join("");
  } catch { return null; }
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
