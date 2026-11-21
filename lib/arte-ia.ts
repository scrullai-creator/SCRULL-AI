// Arte completa feita pela IA, como uma agência faria: a foto, o título grande, a composição
// e as cores saem numa peça só (o GPT desenha; o Claude escreveu o texto e a direção de arte).
// Depois o Claude revisa a arte pronta (texto certo e legível, foto clara, sem espaço morto)
// e, se reprovar, a arte é refeita uma vez com as correções.
import sharp from "sharp";

const MODELO_IMG = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5";
const QUALIDADE = process.env.OPENAI_ART_QUALITY ?? process.env.OPENAI_IMAGE_QUALITY ?? "medium";
const MODELO_REVISAO = process.env.ANTHROPIC_REVIEW_MODEL ?? "claude-sonnet-5-5";

export type PedidoArte = {
  empresa: string;
  ramo: string;
  estilo: string;              // direção de arte do manual (inglês)
  cores: string;               // cores da marca, em palavras ou hex
  titulo: string;
  subtitulo?: string;
  topicos?: string[];
  cena: string;                // descrição da foto pensada pelo Claude (inglês)
  // Referências enviadas junto: fotos reais do cliente (o produto não pode mudar) e/ou o mascote
  referencias?: { bytes: Buffer; tipo: "produto" | "mascote" }[];
  reservarCantoLogo: boolean;  // deixa o canto inferior direito livre para a logo
  assinatura?: string;         // ex.: "@scrull.ai", escrito pequeno num canto
};

function montarPrompt(p: PedidoArte, correcoes?: string) {
  const textos = [
    `HEADLINE (the biggest element, bold, high contrast, roughly a third of the image): "${p.titulo}"`,
    p.subtitulo ? `SUBTITLE (smaller, one line): "${p.subtitulo}"` : "",
    p.topicos?.length ? `SHORT LIST (2–3 items, with simple check icons): ${p.topicos.map((t) => `"${t}"`).join(", ")}` : "",
  ].filter(Boolean).join("\n");
  const refs = (p.referencias ?? []).map((r) =>
    r.tipo === "produto"
      ? "Use the product/place from the reference photo as the hero subject. Keep it exactly as it is (do not change the product, labels or shapes), just make it look its best."
      : "Include the friendly purple robot mascot from the reference image, keeping its exact design, integrated naturally in the scene (not as a pasted sticker or app icon). " +
        "The mascot must be ACTIVELY DOING the action the post is about (for example: holding a smartphone and photographing the product, " +
        "adjusting a light, arranging the product, scheduling posts on a tablet, celebrating likes popping up), never just standing or pointing."
  ).join(" ");
  return (
    `Design a finished, professional square Instagram feed post (1:1), the kind a top social media agency delivers, for "${p.empresa}" (${p.ramo}).\n` +
    `ART DIRECTION: ${p.estilo}\n` +
    `PHOTO / SCENE: ${p.cena}\n` +
    `The scene must tell a small story and look desirable: show a specific, attractive, real-looking product or place of a small business ` +
    `with context and props (never a generic stock object like an empty bottle, a plain box or a blank mug).\n` +
    `BRAND COLORS: ${p.cores || "choose colors that fit the segment"}.\n` +
    (refs ? `REFERENCES: ${refs}\n` : "") +
    `TEXT — write EXACTLY these words in Brazilian Portuguese, with correct accents and spelling, nothing else:\n${textos}\n` +
    `SAFE ZONE (very important): Instagram's profile grid crops the left and right sides of the post. Keep ALL text, the headline, the list and the main subject ` +
    `fully inside the central 70% of the width (leave at least 15% empty margin on the left and on the right, and 8% at the top and bottom); ` +
    `no word may touch or get close to the left or right edge. Only background, scenery and decoration may extend to the edges.\n` +
    `RULES: the headline must be large and easy to read on a phone; the layout must feel full and intentional (no large empty or dull areas); ` +
    `photography sharp, well lit and clearly showing the subject; no other words, no fake logos, no brand names, no watermarks, no lorem ipsum, ` +
    `no misspelled or invented letters. All icons, checkmarks, shapes and accents use the brand colors (never default blue).` +
    (p.assinatura ? ` Add the handle "${p.assinatura}" small and discreet in a corner.` : "") +
    (p.reservarCantoLogo ? ` Leave the bottom-right corner (about 16% of the width) clean and simple for the brand logo, which will be added later.` : "") +
    (correcoes ? `\nFIX THESE PROBLEMS FROM THE PREVIOUS VERSION: ${correcoes}` : "")
  );
}

async function chamarOpenAI(prompt: string, referencias: Buffer[]): Promise<Buffer> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new Error("OPENAI_API_KEY não configurada");
  let res: Response;
  if (referencias.length) {
    const fd = new FormData();
    fd.append("model", MODELO_IMG);
    fd.append("prompt", prompt);
    fd.append("size", "1024x1024");
    fd.append("quality", QUALIDADE);
    fd.append("input_fidelity", "high");
    fd.append("output_format", "jpeg");
    referencias.forEach((b, i) => fd.append("image[]", new Blob([new Uint8Array(b)], { type: "image/png" }), `ref-${i}.png`));
    res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: `Bearer ${chave}` }, body: fd });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODELO_IMG, prompt, size: "1024x1024", quality: QUALIDADE, output_format: "jpeg", n: 1 }),
    });
  }
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.data?.[0]?.b64_json) {
    console.error("Arte IA: erro OpenAI", res.status, j?.error?.message ?? "");
    throw new Error(j?.error?.message ?? `A geração da arte respondeu com erro ${res.status}`);
  }
  if (j.usage) console.log("Arte IA uso:", JSON.stringify(j.usage));
  return Buffer.from(j.data[0].b64_json, "base64");
}

export type Revisao = { aprovada: boolean; nota: number; problemas: string; textoOk?: boolean };

// A IA de imagem às vezes erra acentos e letras ("jà", "prónta"). Por isso o revisor transcreve
// o texto da arte letra por letra, e o app compara com o texto certo, sem confiar só na opinião dele.
const normalizar = (t: string) => t.toLowerCase().replace(/[“”"'.,!?:;…()\-–—]/g, " ").replace(/\s+/g, " ").trim();
export function textoConfere(esperados: string[], lido: string[]): { ok: boolean; faltando: string[] } {
  const tudo = normalizar(lido.join(" "));
  const faltando = esperados.filter((e) => e && !tudo.includes(normalizar(e)));
  return { ok: faltando.length === 0, faltando };
}

export class TextoErrado extends Error {}

// O Claude olha a arte pronta como um diretor de arte exigente
export async function revisarArte(arte: Buffer, p: PedidoArte): Promise<Revisao> {
  // O avaliador vê o recorte central (como a grade do perfil do Instagram mostra o post), para pegar texto cortado nas laterais
  const jpg = await sharp(arte).extract({ left: 128, top: 0, width: 768, height: 1024 }).resize(576, 768).jpeg({ quality: 85 }).toBuffer();
  const esperado = [p.titulo, p.subtitulo, ...(p.topicos ?? [])].filter(Boolean).map((t) => `"${t}"`).join(", ");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODELO_REVISAO, max_tokens: 3000, output_config: { effort: "low" },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpg.toString("base64") } },
          { type: "text", text:
            `Você é diretor de arte de uma agência. Avalie este post de Instagram de "${p.empresa}" (${p.ramo}). ` +
            `A imagem enviada é o recorte central do post, do jeito que a grade do perfil do Instagram mostra (as laterais são cortadas).\n` +
            `Textos que DEVEM aparecer, escritos exatamente assim: ${esperado}.\n` +
            `Reprove se: alguma palavra ou letra do texto estiver cortada ou encostada na borda esquerda ou direita desta imagem; algum texto estiver errado, com letra trocada, acento errado ou palavra inventada; houver texto extra sem sentido; ` +
            `o título estiver pequeno ou difícil de ler no celular; a foto estiver borrada, estranha ou sem mostrar um assunto claro; ` +
            `houver grande espaço vazio ou sem graça; o produto ou cena for genérico e sem apelo (objeto vazio, caixa lisa); ` +
            `a cena não tiver relação com a mensagem do título (quem olha a imagem não entende a ideia "${p.titulo}"); ` +
            `houver um mascote só parado ou apontando, sem fazer a ação do post; ícones fora das cores da marca; parecer amador.\n` +
            `TRANSCREVA todo o texto escrito na imagem EXATAMENTE como está desenhado, letra por letra, com os acentos que aparecem ` +
            `(se estiver "jà" ou "prónta", escreva assim; NÃO corrija nada).\n` +
            `Responda SOMENTE JSON: {"texto_lido": ["cada bloco de texto, como aparece"], "nota": 0-10, "texto_ok": true|false, "problemas": "lista curta em inglês do que corrigir, vazia se nada"}` },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => null);
    console.error("Revisão da arte: erro", res.status, e?.error?.message ?? "");
    return { aprovada: false, nota: -1, problemas: "", textoOk: false }; // sem conferir o texto, usa o texto do app
  }
  const j = await res.json();
  const texto: string = (j.content ?? []).map((b: any) => b.text ?? "").join("");
  try {
    const r = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
    const nota = Number(r.nota) || 0;
    const lido: string[] = Array.isArray(r.texto_lido) ? r.texto_lido.map(String) : [];
    const conf = textoConfere([p.titulo, p.subtitulo ?? "", ...(p.topicos ?? [])], lido);
    const textoOk = !!r.texto_ok && conf.ok;
    if (!conf.ok) console.log("Arte IA: texto diferente do esperado. Faltou:", conf.faltando.join(" | "), "Lido:", lido.join(" | "));
    const problemas = [String(r.problemas ?? ""), conf.ok ? "" : `Text must read exactly: ${conf.faltando.map((t) => `"${t}"`).join(", ")}.`].filter(Boolean).join(" ");
    return { aprovada: textoOk && nota >= 7, nota, problemas: problemas.slice(0, 600), textoOk };
  } catch {
    // Sem conseguir conferir o texto, não arrisca: a arte usa o texto escrito pelo app
    return { aprovada: false, nota: -1, problemas: "", textoOk: false };
  }
}

// Revisão só da FOTO (antes de o app escrever título e logo por cima), para as artes
// montadas pelo modelo do app: nitidez, proporções, enquadramento e apelo.
export async function revisarFoto(foto: Buffer, empresa: string, ramo: string, mensagem = ""): Promise<Revisao> {
  const jpg = await sharp(foto).resize(640, 640, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODELO_REVISAO, max_tokens: 2000, output_config: { effort: "low" },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpg.toString("base64") } },
          { type: "text", text:
            `Você é fotógrafo publicitário e diretor de arte. Esta foto vai virar um post de Instagram de "${empresa}" (${ramo}); ` +
            `o título e a logo serão colocados depois pelo app.\n` +
            `Reprove se: estiver borrada ou sem nitidez; houver mãos, dedos, rostos ou objetos deformados ou com proporção errada; ` +
            `houver letras, números, logos ou marcas d'água; o assunto principal não estiver claro; o enquadramento estiver torto ou cortando o assunto de forma estranha; ` +
            `o produto ou a cena for genérico e sem apelo; não combinar com esse tipo de negócio; parecer artificial ou amador` +
            (mensagem ? `; a foto não tiver nenhuma relação com a mensagem do post: "${mensagem}"` : "") + `.\n` +
            `Responda SOMENTE JSON: {"nota": 0-10, "problemas": "lista curta em inglês do que corrigir, vazia se nada"}` },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => null);
    console.error("Revisão da foto: erro", res.status, e?.error?.message ?? "");
    return { aprovada: true, nota: -1, problemas: "" };
  }
  const j = await res.json();
  const texto: string = (j.content ?? []).map((b: any) => b.text ?? "").join("");
  try {
    const r = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
    const nota = Number(r.nota) || 0;
    return { aprovada: nota >= 7, nota, problemas: String(r.problemas ?? "").slice(0, 600) };
  } catch {
    return { aprovada: true, nota: -1, problemas: "" };
  }
}

// Gera, revisa e, se preciso e houver tempo, refaz uma vez. Devolve a melhor versão.
export async function criarArteCompleta(p: PedidoArte, tempoLimiteMs = 40_000): Promise<{ arte: Buffer; revisao: Revisao }> {
  const inicio = Date.now();
  const refs = (p.referencias ?? []).map((r) => r.bytes);
  let arte = await chamarOpenAI(montarPrompt(p), refs);
  let revisao = await revisarArte(arte, p);
  console.log("Arte IA revisão:", p.empresa, revisao.nota, revisao.aprovada ? "aprovada" : `reprovada: ${revisao.problemas}`);
  if (!revisao.aprovada && Date.now() - inicio < tempoLimiteMs - 35_000) {
    const nova = await chamarOpenAI(montarPrompt(p, revisao.problemas), refs);
    const rev2 = await revisarArte(nova, p);
    console.log("Arte IA revisão (2ª):", p.empresa, rev2.nota, rev2.aprovada ? "aprovada" : `reprovada: ${rev2.problemas}`);
    // A segunda só entra se o texto dela estiver certo
    if (rev2.textoOk && (rev2.aprovada || !revisao.textoOk || rev2.nota >= revisao.nota)) { arte = nova; revisao = rev2; }
  }
  // Texto ainda errado (acento, letra trocada) depois da nova tentativa: o app escreve o texto, que sai sempre certo
  if (!revisao.textoOk) throw new TextoErrado(revisao.problemas || "texto da arte não confere");
  return { arte, revisao };
}

// Coloca a logo do cliente no canto inferior direito, pequena e com uma base branca suave
export async function aplicarLogo(arte: Buffer, logo: { bytes: Buffer } | null): Promise<Buffer> {
  const base = sharp(arte).resize(1024, 1024);
  if (!logo) return base.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  const marca = await sharp(logo.bytes).resize(120, 120, { fit: "inside" }).png().toBuffer();
  const meta = await sharp(marca).metadata();
  const w = (meta.width ?? 120) + 28, h = (meta.height ?? 120) + 28;
  const fundo = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.92 } } })
    .composite([{ input: marca, gravity: "center" }]).png().toBuffer();
  const arred = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="18" ry="18"/></svg>`);
  const selo = await sharp(fundo).composite([{ input: arred, blend: "dest-in" }]).png().toBuffer();
  return base.composite([{ input: selo, left: 1024 - w - 36, top: 1024 - h - 36 }]).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
