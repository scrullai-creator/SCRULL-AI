"use server";
// Ações do painel. Rodam no servidor, como o cliente logado:
// as regras de segurança do banco garantem que ele só mexe nos próprios dados.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseDoUsuario } from "@/lib/supabase";

const id = (f: FormData) => String(f.get("id") ?? "");

export async function aprovarPost(f: FormData) {
  const s = await supabaseDoUsuario();
  await s.from("posts").update({ status: "aprovado" })
    .eq("id", id(f)).in("status", ["aguardando_aprovacao", "recusado"]);
  revalidatePath("/painel");
}

export async function recusarPost(f: FormData) {
  const s = await supabaseDoUsuario();
  await s.from("posts").update({ status: "recusado" })
    .eq("id", id(f)).in("status", ["aguardando_aprovacao", "aprovado"]);
  revalidatePath("/painel");
}

export async function aprovarTodos() {
  const s = await supabaseDoUsuario();
  await s.from("posts").update({ status: "aprovado" }).eq("status", "aguardando_aprovacao");
  revalidatePath("/painel");
}

export async function salvarLegenda(f: FormData) {
  const legenda = String(f.get("legenda") ?? "").trim().slice(0, 2200);
  if (!legenda) return;
  const s = await supabaseDoUsuario();
  await s.from("posts").update({ legenda }).eq("id", id(f));
  revalidatePath("/painel");
}

const CAMPOS = ["postar_sem_aprovacao", "melhor_horario", "pausado"];
export async function alternarConfig(f: FormData) {
  const campo = String(f.get("campo"));
  if (!CAMPOS.includes(campo)) return;
  const atual = f.get("valor") === "true";
  const s = await supabaseDoUsuario();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return;
  await s.from("configuracoes").update({ [campo]: !atual }).eq("cliente_id", user.id);
  revalidatePath("/painel");
}

export async function sair() {
  const s = await supabaseDoUsuario();
  await s.auth.signOut();
  redirect("/login");
}
