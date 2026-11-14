// Gera a arte do post com a API de imagens da OpenAI e guarda no Supabase Storage.
// A descrição (prompt) vem do Claude; se o cliente tiver logo, ela vai junto como
// referência para aparecer igual em todas as artes.
import { supabaseAdmin } from "./supabase";

const MODELO = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5";
const QUALIDADE = process.env.OPENAI_IMAGE_QUALITY ?? "medium"; // low | medium | high
const PASTA = "artes";

async function lerErro(res: Response) {
  const j = await res.json().catch(() => null);
  console.error("OpenAI imagens erro:", res.status, j?.error?.type ?? "", j?.error?.message ?? "");
  throw new Error(j?.error?.message ?? `A geração de imagem respondeu com erro ${res.status}`);
}

// Devolve os bytes JPEG da imagem gerada
export async function gerarImagem(prompt: string, logoUrl?: string | null): Promise<Buffer> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new Error("OPENAI_API_KEY não configurada");
  const cabecalho = { authorization: `Bearer ${chave}` };

  let res: Response;
  if (logoUrl) {
    // Com logo: endpoint de edição aceita imagens de referência junto com o prompt
    const logo = await fetch(logoUrl);
    if (!logo.ok) throw new Error("Não foi possível ler a logo");
    const tipo = logo.headers.get("content-type") ?? "image/png";
    const blob = new Blob([await logo.arrayBuffer()], { type: tipo });

    const form = new FormData();
    form.append("model", MODELO);
    form.append(
      "prompt",
      `${prompt} The attached image is the brand's official logo: place it unchanged ` +
        `(same shape, colors and proportions) at the bottom-right corner, small, on a subtle backdrop if needed.`
    );
    form.append("image[]", blob, "logo." + (tipo.includes("png") ? "png" : "jpg"));
    form.append("size", "1024x1024");
    form.append("quality", QUALIDADE);
    form.append("output_format", "jpeg");
    form.append("output_compression", "85");
    res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: cabecalho, body: form });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { ...cabecalho, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELO, prompt, size: "1024x1024", quality: QUALIDADE,
        output_format: "jpeg", output_compression: 85, n: 1,
      }),
    });
  }
  if (!res.ok) await lerErro(res);

  const j = await res.json();
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error("A geração de imagem não devolveu a arte");
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

// Gera a arte de um post e salva a URL nele
export async function gerarArteDoPost(postId: string, clienteId: string) {
  const db = supabaseAdmin();
  const [{ data: post }, { data: cliente }] = await Promise.all([
    db.from("posts").select("id, prompt_imagem, titulo_arte, topicos").eq("id", postId).eq("cliente_id", clienteId).single(),
    db.from("clientes").select("logo_url, nome_empresa").eq("id", clienteId).single(),
  ]);
  if (!post) throw new Error("Post não encontrado");

  const prompt = post.prompt_imagem || promptPadrao(post.titulo_arte, post.topicos ?? [], cliente?.nome_empresa ?? "");
  const bytes = await gerarImagem(prompt, cliente?.logo_url);
  const url = await guardarArquivo(`${clienteId}/${postId}-${Date.now()}.jpg`, bytes, "image/jpeg");

  const { error } = await db.from("posts").update({ imagem_url: url }).eq("id", postId);
  if (error) throw error;
  return url;
}

// Posts antigos (criados antes do prompt da imagem) ganham um prompt simples
function promptPadrao(titulo: string | null, topicos: string[], empresa: string) {
  const t = topicos.length ? topicos : ["Qualidade", "Agilidade", "Atendimento"];
  return (
    `Square Instagram post, professional photographic background related to a small business, no people, no text in the scene. ` +
    `Dark semi-transparent overlay so the text stands out. Bold white sans-serif title at the bottom-left reading exactly: '${titulo ?? empresa}'. ` +
    `Below it, 3 lines with small check icons reading exactly: '${t[0]}', '${t[1]}', '${t[2]}'. ` +
    `Clean, modern, high contrast, no other text, no watermark.`
  );
}
