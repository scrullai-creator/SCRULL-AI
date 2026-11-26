// Gera a arte do post com a API de imagens da OpenAI e guarda no Supabase Storage.
// A descrição (prompt) vem do Claude; se o cliente tiver logo, ela vai junto como
// referência para aparecer igual em todas as artes.
import { supabaseAdmin } from "./supabase";
import { montarArte, corDaMarca, fonteDoRamo } from "./arte";
import { montarArteScrull, modeloScrull, LUZ_SEM } from "./arte-scrull";
import { criarArteCompleta, aplicarLogo, revisarFoto, revisarRestricoes } from "./arte-ia";
import { segmentoDoRamo, escolherDirecao, impressaoDigital, parecidaDemais, type Visual } from "./direcao-arte";
import sharp from "sharp";
import { lerBriefing } from "./briefing";
import { listarFotos, prepararFoto } from "./fotos";
import { ehPerfilDeReceitas, agruparIngredientes } from "./receitas";

const MODELO = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5";
const QUALIDADE = process.env.OPENAI_IMAGE_QUALITY ?? "medium"; // low | medium | high
const PASTA = "artes";

async function lerErro(res: Response) {
  const j = await res.json().catch(() => null);
  console.error("OpenAI imagens erro:", res.status, j?.error?.type ?? "", j?.error?.message ?? "");
  throw new Error(j?.error?.message ?? `A geração de imagem respondeu com erro ${res.status}`);
}

// Gera só a FOTO de fundo (sem texto nenhum): o título e a logo são escritos pelo app
export async function gerarFoto(cena: string, limpa = false): Promise<Buffer> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new Error("OPENAI_API_KEY não configurada");
  // "limpa": a foto É o post (sem texto por cima). Pede cara de foto real de fotógrafo, clara e natural, não de imagem de IA.
  const prompt = limpa
    ? `${cena} Authentic, real-life professional photograph taken by a commercial photographer with a full-frame camera and a 50mm lens: ` +
      `bright natural daylight from a window, light and airy mood, light neutral surfaces (white, cream, light wood or linen), true-to-life colors, ` +
      `natural imperfect textures (tiny crumbs, drops, slight asymmetry, real surface wear), realistic scale and proportions, a single clear hero subject, ` +
      `gentle shallow depth of field, slightly imperfect handheld framing like a real photo. ` +
      `NOT a render, NOT an illustration, no CGI or 3D look, no glossy plastic or wax-like surfaces, no over-saturation, no HDR, no vignette, ` +
      `no dramatic, moody, dark or neon lighting, no dark background, no floating objects, no fake perfect symmetry. ` +
      `Absolutely no text, letters, numbers, logos, watermarks or captions anywhere in the image.`
    : `${cena} Photorealistic, professional photography, soft natural light, shallow depth of field. ` +
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

// A IA CRIA uma foto nova para o post, usando as fotos reais do cliente como referência do produto e da marca
// (não como molde para copiar). O post pode ou não mostrar o produto, conforme a cena pedida.
export async function criarComReferencia(refs: Buffer[], cena: string, sobre: string, evitar = ""): Promise<Buffer> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new Error("OPENAI_API_KEY não configurada");
  const prompt =
    `Create a NEW, original professional photograph for an Instagram post of a small business. The reference image(s) show the brand's real product: ` +
    `use them to understand how the product looks and the brand's feel (shape, colors, texture, glaze), but do NOT copy their composition, background or framing. ` +
    `Scene to create: ${cena} ` +
    `Show the product only if the scene calls for it; if it appears, it must clearly be the same kind of product as in the references. ` +
    `${sobre ? `About the business: ${sobre} ` : ""}` +
    `Style: authentic, real-life photo by a commercial photographer, natural window daylight, light and airy, true-to-life colors, natural imperfections, ` +
    `varied and creative composition, not a render, not plastic, no HDR. ` +
    `${evitar ? `CLIENT RESTRICTION (in Portuguese, follow strictly, never show this): "${evitar}". ` : ""}` +
    `Absolutely no text, letters, numbers, logos or watermarks anywhere in the image.`;
  const form = new FormData();
  form.append("model", MODELO);
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("quality", QUALIDADE);
  form.append("output_format", "jpeg");
  form.append("n", "1");
  refs.slice(0, 3).forEach((r, i) => form.append("image[]", new Blob([new Uint8Array(r)], { type: "image/jpeg" }), `ref${i}.jpg`));
  const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: `Bearer ${chave}` }, body: form });
  if (!res.ok) await lerErro(res);
  const j = await res.json();
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error("A criação de imagem não devolveu a foto");
  if (j.usage) console.log("OpenAI criação uso:", JSON.stringify(j.usage));
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
  // Perfil de receitas: cada post é uma receita, com os modelos "potes" e "receita" (ver lib/receitas.ts)
  const receitas = !ehScrull && ehPerfilDeReceitas(cliente?.nome_empresa, cliente?.ramo);
  const fotosDoCliente = ehScrull || receitas ? [] : await listarFotos(clienteId).catch(() => []);
  const escolhida = fotosDoCliente.length > 0 && usadas < fotosDoCliente.length
    ? await prepararFoto(fotosDoCliente[(gancho + usadas) % fotosDoCliente.length].url) : null;
  const logo = ehScrull ? null : await lerLogo(cliente?.logo_url);
  const corHex = briefing.cores ? corDaMarca(briefing.cores) : (await corDaLogo(logo)) ?? null;

  // Memória visual DESTE cliente: a próxima arte evita o estilo, o ângulo e a composição usados por último
  const memoria = await lerMemoria(clienteId, postId);
  const segmento = ehScrull ? "tecnologia" : receitas ? "comida" : segmentoDoRamo(cliente?.ramo ?? "");
  const direcao = escolherDirecao(segmento, memoria, gancho, usadas, ehScrull);
  const visual: Visual = { segmento, estilo: direcao.estilo, enquadramento: direcao.enquadramento, layout: post.layout };

  // Arte completa pela IA (foto + texto + composição numa peça só, revisada pelo Claude).
  // Por enquanto ligada só no próprio Scrull; ARTE_IA_TODOS=1 liga para todos os clientes.
  let pronta: Buffer | null = null;
  if (!receitas && (ehScrull || process.env.ARTE_IA_TODOS === "1")) {
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
        evitar: briefing.evitar,
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
  } else if (receitas) {
    bytes = await arteDeReceita({
      post, cena, titulo, logo, briefing, inicio, memoria, visual,
      empresa: cliente?.nome_empresa ?? "", cor: corHex,
    });
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
    // Negócios em que o produto é o astro (comida, moda, beleza): a foto é o post, limpa, sem frase por cima
    const fotoLimpa = segmento === "comida" || segmento === "moda" || segmento === "beleza";
    // Piloto "produto real": nestes clientes, sem foto real do produto o app NÃO inventa uma foto dele; usa arte gráfica da marca.
    // Ligado por cliente em PRODUTO_REAL_CLIENTES (ids separados por vírgula, ou * para todos).
    const lista = (process.env.PRODUTO_REAL_CLIENTES ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const produtoReal = fotoLimpa && (lista.includes("*") || lista.includes(clienteId));
    let foto: Buffer;
    if (escolhida) {
      foto = escolhida;
      visual.origem = "foto-cliente";
      // A IA cria uma foto nova a partir das fotos reais (referência). A revisão só barra o que o cliente pediu para NÃO aparecer,
      // texto/logo/marca d'água e defeitos graves; se não passar em 2 tentativas, vale a foto real do cliente.
      const refs = [escolhida];
      for (let k = 1; k <= 2 && k < fotosDoCliente.length; k++) {
        const extra = await prepararFoto(fotosDoCliente[(gancho + usadas + k) % fotosDoCliente.length].url).catch(() => null);
        if (extra) refs.push(extra);
      }
      const cenaCriativa = cena + " " + direcao.textoEnquadramento;
      for (let t = 0; t < 2; t++) {
        try {
          const nova = await criarComReferencia(refs, cenaCriativa, briefing.sobre ?? "", briefing.evitar ?? "");
          const rev = await revisarRestricoes(nova, briefing.evitar ?? "");
          if (rev.aprovada) { foto = nova; visual.origem = "ia-criativa"; break; }
          console.warn("[criar-foto] reprovada:", rev.problemas);
        } catch (e: any) {
          console.error("[criar-foto] falhou:", e?.message);
        }
      }
    } else if (produtoReal) {
      foto = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
      visual.origem = "arte-grafica";
    } else {
      const restricao = briefing.evitar ? ` CLIENT RESTRICTION (in Portuguese, follow strictly): "${briefing.evitar}".` : "";
      foto = await fotoRevisada(cena + " " + direcao.textoEnquadramento + restricao, cliente?.nome_empresa ?? "", cliente?.ramo ?? "", memoria, inicio, visual,
        [titulo, post.subtitulo].filter(Boolean).join(" — "), briefing.evitar ?? "", fotoLimpa);
      visual.origem = "modelo";
    }
    if (visual.origem !== "arte-grafica") visual.hash ??= await impressaoDigital(foto);
    const layoutFinal = visual.origem === "arte-grafica" ? "marca" as const : fotoLimpa ? "foto" as const : escolherLayout(post.layout, gancho, usadas);
    visual.layout = layoutFinal;
    bytes = await montarArte({
      fundoJpeg: foto, titulo, topicos: post.topicos ?? [],
      layout: layoutFinal, subtitulo: post.subtitulo ?? "",
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

// Arte de um post de receita. "potes": a IA desenha a peça inteira (prato + potinhos com as quantidades) e o Claude confere
// cada etiqueta; se o texto não sair certo, ou no modelo "receita", o app monta o cartão de receita sobre uma foto do prato.
async function arteDeReceita(a: {
  post: { layout?: string | null; subtitulo?: string | null; topicos?: string[] | null };
  cena: string; titulo: string; empresa: string; cor: string | null;
  logo: { bytes: Buffer; tipo: string } | null; briefing: ReturnType<typeof lerBriefing>;
  inicio: number; memoria: Visual[]; visual: Visual;
}): Promise<Buffer> {
  const ingredientes = agruparIngredientes(a.post.topicos ?? []);
  const evitar = a.briefing.evitar ?? "";
  if (a.post.layout === "potes") {
    try {
      const { arte, revisao } = await criarArteCompleta({
        empresa: a.empresa, ramo: "perfil de receitas caseiras",
        estilo: "Warm homemade recipe card ad, like the most shared recipe posts on Instagram: soft beige/cream background, " +
          "natural kitchen daylight, a striped kitchen towel and fresh ingredients as props, bold dark-brown and orange headline.",
        cores: a.briefing.cores || "warm beige and cream background, dark brown text, orange accents",
        titulo: a.titulo, subtitulo: a.post.subtitulo ?? "", topicos: [],
        rotulos: ingredientes.flatMap((g) => g.itens),
        cena: a.cena, referencias: [], reservarCantoLogo: !!a.logo, evitar,
      }, 60_000);
      a.visual.origem = "ia-completa"; a.visual.nota = revisao.nota; a.visual.layout = "potes";
      a.visual.hash = await impressaoDigital(arte);
      return await aplicarLogo(arte, a.logo);
    } catch (e: any) {
      console.error("Receita (potes): arte da IA não passou; usando o cartão de receita:", e?.message);
    }
  }
  const restricao = evitar ? ` CLIENT RESTRICTION (in Portuguese, follow strictly): "${evitar}".` : "";
  const foto = await fotoRevisada(
    a.cena + " Camera: 45-degree or top-down view, the whole finished dish centered and generous, appetizing, homemade, served on a plate on a light kitchen table." + restricao,
    a.empresa, "receitas caseiras", a.memoria, a.inicio, a.visual, a.titulo, evitar, true);
  a.visual.origem = "modelo"; a.visual.layout = "receita";
  return montarArte({
    fundoJpeg: foto, titulo: a.titulo, subtitulo: a.post.subtitulo ?? "", topicos: [], layout: "receita",
    logo: null, nomeEmpresa: a.empresa, cor: a.cor ?? "#8a4b1f", fonteTitulo: "Sora", ingredientes,
  });
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
async function fotoRevisada(cena: string, empresa: string, ramo: string, memoria: Visual[], inicio: number, visual: Visual, mensagem = "", evitar = "", limpa = false) {
  const foto = await gerarFoto(cena, limpa);
  const [rev, hash] = await Promise.all([revisarFoto(foto, empresa, ramo, mensagem, evitar, limpa), impressaoDigital(foto)]);
  const repetida = parecidaDemais(hash, memoria);
  console.log("Foto revisão:", empresa, rev.nota, rev.aprovada ? "aprovada" : `reprovada: ${rev.problemas}`, repetida ? "(parecida com arte recente)" : "");
  visual.nota = rev.nota; visual.hash = hash;
  if ((rev.aprovada && !repetida) || Date.now() - inicio > 22_000) return foto;

  const correcoes = [rev.aprovada ? "" : rev.problemas,
    repetida ? "Too similar to a recent post: use a clearly different camera angle, setting and color mood." : ""].filter(Boolean).join(" ");
  const nova = await gerarFoto(`${cena} FIX THESE PROBLEMS: ${correcoes}`, limpa);
  const [rev2, hash2] = await Promise.all([revisarFoto(nova, empresa, ramo, mensagem, evitar, limpa), impressaoDigital(nova)]);
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
