"use server";
// Ações do painel. Rodam no servidor, como o cliente logado:
// as regras de segurança do banco garantem que ele só mexe nos próprios dados.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseDoUsuario, supabaseAdmin } from "@/lib/supabase";
import { registrar } from "@/lib/historico";

const id = (f: FormData) => String(f.get("id") ?? "");

async function logado() {
  const s = await supabaseDoUsuario();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/login");
  return { s, user };
}

// Volta para o mesmo post e para a mesma aba/visão em que o cliente estava
function voltar(f: FormData, aviso?: string) {
  const vista = String(f.get("vista") ?? "");
  const q = new URLSearchParams(vista.startsWith("?") ? vista.slice(1) : vista);
  if (aviso) q.set("ig", aviso); else q.delete("ig");
  const ancora = id(f) ? `#post-${id(f)}` : "";
  redirect(`/painel${q.toString() ? `?${q}` : ""}${ancora}`);
}

export async function aprovarPost(f: FormData) {
  const { s, user } = await logado();
  const { data } = await s.from("posts").update({ status: "aprovado" })
    .eq("id", id(f)).in("status", ["aguardando_aprovacao", "recusado", "erro"]).select("id, agendado_para");
  if (data?.length) await registrar(id(f), user.id, "aprovado", `para ${new Date(data[0].agendado_para).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}`);
  revalidatePath("/painel");
  voltar(f, data?.length ? "aprov-ok" : undefined);
}

export async function recusarPost(f: FormData) {
  const { s, user } = await logado();
  const { data } = await s.from("posts").update({ status: "recusado" })
    .eq("id", id(f)).in("status", ["aguardando_aprovacao", "aprovado", "erro"]).select("id");
  if (data?.length) await registrar(id(f), user.id, "recusado");
  revalidatePath("/painel");
  voltar(f);
}

export async function aprovarTodos(f: FormData) {
  const { s, user } = await logado();
  const { data } = await s.from("posts").update({ status: "aprovado" })
    .eq("cliente_id", user.id).eq("status", "aguardando_aprovacao").select("id");
  if (data?.length) await registrar(data.map((p) => p.id), user.id, "aprovado", "aprovar todos");
  revalidatePath("/painel");
  voltar(f, data?.length ? "aprov-todos" : undefined);
}

export async function salvarLegenda(f: FormData) {
  const legenda = String(f.get("legenda") ?? "").trim().slice(0, 2200);
  if (!legenda) return;
  const { s, user } = await logado();
  const { data } = await s.from("posts").update({ legenda }).eq("id", id(f)).neq("status", "publicado").select("id");
  if (data?.length) await registrar(id(f), user.id, "legenda", "editada à mão");
  revalidatePath("/painel");
  voltar(f, data?.length ? "leg-salva" : undefined);
}

// Muda a data e a hora em que o post sai (só posts que ainda não foram ao ar)
export async function mudarHorario(f: FormData) {
  const { user } = await logado();
  const valor = String(f.get("quando") ?? ""); // AAAA-MM-DDTHH:MM, horário de Brasília
  const quando = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor) ? new Date(`${valor}:00-03:00`) : null;
  if (!quando || isNaN(quando.getTime()) || quando.getTime() < Date.now() + 5 * 60000) return voltar(f, "hora-erro");
  if (quando.getTime() > Date.now() + 120 * 86400000) return voltar(f, "hora-erro");
  // A coluna da data só o servidor pode mudar: confere o dono do post antes
  const { data } = await supabaseAdmin().from("posts").update({ agendado_para: quando.toISOString() })
    .eq("id", id(f)).eq("cliente_id", user.id).in("status", ["aguardando_aprovacao", "aprovado", "recusado", "erro"]).select("id");
  if (data?.length) await registrar(id(f), user.id, "horario", `nova data: ${quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}`);
  revalidatePath("/painel");
  voltar(f, data?.length ? "hora-ok" : "hora-erro");
}

const CAMPOS = ["postar_sem_aprovacao", "melhor_horario", "pausado", "publicar_facebook"];
export async function alternarConfig(f: FormData) {
  const campo = String(f.get("campo"));
  if (!CAMPOS.includes(campo)) return;
  const atual = f.get("valor") === "true";
  const { s, user } = await logado();
  await s.from("configuracoes").update({ [campo]: !atual }).eq("cliente_id", user.id);
  revalidatePath("/painel");
}

export async function sair() {
  const s = await supabaseDoUsuario();
  await s.auth.signOut();
  redirect("/login");
}
