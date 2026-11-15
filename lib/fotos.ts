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
  return sharp(Buffer.from(await res.arrayBuffer()))
    .resize(1024, 1024, { fit: "cover", position: "attention" })
    .modulate({ brightness: 1.04, saturation: 1.08 }).sharpen()
    .jpeg({ quality: 90 }).toBuffer();
}
