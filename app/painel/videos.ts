"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseDoUsuario, supabaseAdmin } from "@/lib/supabase";
import {
  prepararEnvio, registrarVideo, apagarVideo, criarReels, podeUsarVideos, videosDoMes,
  MAX_VIDEOS_MES,
} from "@/lib/videos";

async function usuario() {
  const { data: { user } } = await (await supabaseDoUsuario()).auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return user;
}

async function liberado(userId: string, email: string) {
  const { data: c } = await supabaseAdmin().from("clientes").select("plano_id, assinatura").eq("id", userId).single();
  const ehDono = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((e) => e.trim()).includes(email.toLowerCase());
  return podeUsarVideos(c, ehDono);
}

type Resposta = { ok: true; caminho: string; token: string } | { ok: false; msg: string };

// Passo 1: o navegador pede um endereço para enviar o vídeo direto ao Storage
export async function pedirEnvio(tipo: string): Promise<Resposta> {
  const u = await usuario();
  if (!(await liberado(u.id, u.email ?? ""))) return { ok: false, msg: "Vídeos fazem parte do plano Premium." };
  if ((await videosDoMes(u.id)) >= MAX_VIDEOS_MES) return { ok: false, msg: `Você já enviou ${MAX_VIDEOS_MES} vídeos este mês. O limite renova no dia 1.` };
  const ext = tipo === "video/quicktime" ? "mov" : "mp4";
  try {
    return { ok: true, ...(await prepararEnvio(u.id, ext)) };
  } catch (e) {
    console.error("Vídeo: erro ao preparar envio", e);
    return { ok: false, msg: "Não foi possível preparar o envio agora. Tente de novo em instantes." };
  }
}

// Passo 2: o arquivo chegou; registra e manda para a edição
export async function confirmarEnvio(caminho: string, descricao: string, duracao: number): Promise<string> {
  const u = await usuario();
  if (!(await liberado(u.id, u.email ?? ""))) return "Vídeos fazem parte do plano Premium.";
  try {
    await registrarVideo(u.id, caminho, descricao, duracao);
  } catch (e: any) {
    console.error("Vídeo: erro ao registrar", e?.message);
    return e?.message ?? "Não foi possível guardar o vídeo.";
  }
  revalidatePath("/painel");
  return "Vídeo recebido!";
}

export async function removerVideo(f: FormData) {
  const u = await usuario();
  try {
    await apagarVideo(u.id, String(f.get("id") ?? ""));
  } catch (e: any) {
    console.error("Vídeo: erro ao apagar", e?.message);
  }
  revalidatePath("/painel");
}

export async function transformarEmReels(f: FormData) {
  const u = await usuario();
  let resultado = "reels-erro";
  let ancora = "";
  try {
    if (await liberado(u.id, u.email ?? "")) {
      const id = await criarReels(u.id, String(f.get("id") ?? ""));
      resultado = "reels-ok";
      ancora = `#post-${id}`;
    }
  } catch (e: any) {
    console.error("Vídeo: erro ao criar reels", e?.message);
  }
  revalidatePath("/painel");
  redirect(`/painel?ig=${resultado}${ancora}`);
}
