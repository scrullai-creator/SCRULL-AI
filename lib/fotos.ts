// Fotos que o cliente envia (produtos, pratos, loja...). Ficam em fotos/<cliente>/ no Storage
// e são usadas como fundo das artes, no lugar de uma foto gerada por IA.
import sharp from "sharp";
import { supabaseAdmin } from "./supabase";

const PASTA = "artes";
export const MAX_FOTOS = 8;
const dir = (clienteId: string) => `fotos/${clienteId}`;

export async function listarFotos(clienteId: string) {
  const db = supabaseAdmin();
  const { data } = await db.storage.from(PASTA).list(dir(clienteId), { limit: 100, sortBy: { column: "created_at", order: "asc" } });
  return (data ?? []).filter((f) => f.name.endsWith(".jpg")).map((f) => ({
    nome: f.name,
    url: db.storage.from(PASTA).getPublicUrl(`${dir(clienteId)}/${f.name}`).data.publicUrl,
  }));
}

// Endireita (EXIF), limita o tamanho e salva como JPG
export async function guardarFoto(clienteId: string, bytes: Buffer) {
  const jpg = await sharp(bytes).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
  const { error } = await supabaseAdmin().storage.from(PASTA).upload(`${dir(clienteId)}/${nome}`, jpg, { contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
}

export async function removerFoto(clienteId: string, nome: string) {
  if (!/^[\w.-]+\.jpg$/.test(nome)) return;
  await supabaseAdmin().storage.from(PASTA).remove([`${dir(clienteId)}/${nome}`]);
}

// Foto do cliente pronta para a arte: quadrada, com luz e nitidez levemente melhoradas.
// Não altera o produto: só ajuste de brilho, cor e foco.
export async function prepararFoto(url: string): Promise<Buffer | null> {
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return null;
  const original = sharp(Buffer.from(await res.arrayBuffer())).rotate();
  const meta = await original.clone().metadata();
  const ajustar = (img: ReturnType<typeof sharp>) => img.modulate({ brightness: 1.04, saturation: 1.08 }).sharpen();
  const proporcao = (meta.width ?? 1) / (meta.height ?? 1);
  // Foto quase quadrada ou em pé: recorte quadrado centralizado no assunto
  if (proporcao >= 0.62 && proporcao < 1.2) {
    return ajustar(original.resize(1024, 1024, { fit: "cover", position: "attention" })).jpeg({ quality: 90 }).toBuffer();
  }
  // Foto deitada moderada (até ~16:9): recorte quadrado no CENTRO, onde o produto costuma ficar,
  // preenchendo o quadro todo (sem moldura nem bordas esfumadas).
  if (proporcao >= 1.2 && proporcao <= 1.8) {
    return ajustar(original.resize(1024, 1024, { fit: "cover", position: "centre" })).jpeg({ quality: 90 }).toBuffer();
  }
  // Foto deitada: mostra o produto INTEIRO, com respiro em volta (a grade do Instagram corta as laterais),
  // sobre um fundo liso da cor das bordas da foto e com as bordas se dissolvendo, sem emenda dura.
  const bordas = await original.clone().extract({ left: 0, top: 0, width: meta.width ?? 1, height: Math.max(1, Math.round((meta.height ?? 1) * 0.06)) })
    .resize(1, 1, { fit: "cover" }).raw().toBuffer();
  const fundo = { r: bordas[0], g: bordas[1], b: bordas[2] };
  const pronta = await ajustar(original.clone().resize(940, 940, { fit: "inside" })).png().toBuffer();
  const { width: w = 940, height: h = 700 } = await sharp(pronta).metadata();
  const f = Math.max(8, Math.round(Math.min(w, h) * 0.12));
  const alfa = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    const ay = Math.min(1, Math.min(y, h - 1 - y) / f);
    for (let x = 0; x < w; x++) {
      const ax = Math.min(1, Math.min(x, w - 1 - x) / f);
      alfa[y * w + x] = Math.round(255 * Math.min(ay, ax));
    }
  }
  const rgb = await sharp(pronta).removeAlpha().raw().toBuffer();
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { rgba[i * 4] = rgb[i * 3]; rgba[i * 4 + 1] = rgb[i * 3 + 1]; rgba[i * 4 + 2] = rgb[i * 3 + 2]; rgba[i * 4 + 3] = alfa[i]; }
  const frente = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return sharp({ create: { width: 1024, height: 1024, channels: 3, background: fundo } })
    .composite([{ input: frente, gravity: "centre" }]).jpeg({ quality: 90 }).toBuffer();
}
