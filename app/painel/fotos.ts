"use server";
import { revalidatePath } from "next/cache";
import { supabaseDoUsuario } from "@/lib/supabase";
import { guardarFoto, listarFotos, removerFoto, MAX_FOTOS } from "@/lib/fotos";

async function dono() {
  const { data: { user } } = await (await supabaseDoUsuario()).auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return user.id;
}

export async function enviarFotos(f: FormData): Promise<string> {
  const id = await dono();
  const jaTem = (await listarFotos(id)).length;
  const arquivos = f.getAll("fotos").filter((x): x is File => x instanceof File && x.size > 0 && x.type.startsWith("image/"));
  const vagas = MAX_FOTOS - jaTem;
  if (vagas <= 0) return `Você já tem ${MAX_FOTOS} fotos. Remova alguma para enviar outra.`;
  let enviadas = 0;
  for (const a of arquivos.slice(0, vagas)) {
    if (a.size > 3_000_000) continue;
    try { await guardarFoto(id, Buffer.from(await a.arrayBuffer())); enviadas++; } catch { /* segue com as outras */ }
  }
  revalidatePath("/painel");
  if (!enviadas) return "Não consegui enviar essas fotos. Tente imagens JPG ou PNG.";
  return arquivos.length > vagas ? `${enviadas} fotos enviadas. O limite é ${MAX_FOTOS}.` : `${enviadas} ${enviadas === 1 ? "foto enviada" : "fotos enviadas"}!`;
}

export async function apagarFoto(f: FormData) {
  await removerFoto(await dono(), String(f.get("nome") ?? ""));
  revalidatePath("/painel");
}
