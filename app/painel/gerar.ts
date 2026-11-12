"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseDoUsuario, supabaseAdmin } from "@/lib/supabase";
import { criarPosts } from "@/lib/gerar-posts";

const HORAS = ["19:00", "12:00", "11:30", "18:30", "19:00", "12:30", "19:00"];

function horario(dias: number, hhmm: string) {
  const dia = new Date(Date.now() + dias * 86400000)
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${dia}T${hhmm}:00-03:00`).toISOString();
}

export async function salvarPerfil(f: FormData) {
  const ramo = String(f.get("ramo") ?? "").trim().slice(0, 120);
  const tom = String(f.get("tom") ?? "").trim().slice(0, 60);
  if (!ramo) return;
  const s = await supabaseDoUsuario();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return;
  await s.from("clientes").update({ ramo, ...(tom && { tom_de_voz: tom }) }).eq("id", user.id);
  revalidatePath("/painel");
}

export async function gerarSemana() {
  const s = await supabaseDoUsuario();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/login");

  const db = supabaseAdmin();
  let resultado = "ger-erro";
  try {
    const { data: cliente } = await db.from("clientes")
      .select("nome_empresa, ramo, tom_de_voz, plano_id").eq("id", user.id).single();
    const { data: conta } = await db.from("contas_instagram").select("id")
      .eq("cliente_id", user.id).eq("ativa", true).limit(1).maybeSingle();
    if (!cliente?.ramo || !conta) throw new Error("Perfil incompleto");

    // Economia: no máximo uma geração a cada 12 horas por cliente
    const desde = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { count } = await db.from("posts").select("id", { count: "exact", head: true })
      .eq("cliente_id", user.id).gte("criado_em", desde);

    if ((count ?? 0) > 0) {
      resultado = "ger-cedo";
    } else {
      const [{ data: plano }, { data: cfg }] = await Promise.all([
        db.from("planos").select("posts_por_semana").eq("id", cliente.plano_id).single(),
        db.from("configuracoes").select("postar_sem_aprovacao").eq("cliente_id", user.id).single(),
      ]);
      const qtd = plano?.posts_por_semana ?? 7;
      const lista = await criarPosts({
        empresa: cliente.nome_empresa, ramo: cliente.ramo, tom: cliente.tom_de_voz, quantidade: qtd,
      });
      const passo = qtd >= 7 ? 1 : 2;
      const status = cfg?.postar_sem_aprovacao ? "aprovado" : "aguardando_aprovacao";
      const { error } = await db.from("posts").insert(
        lista.map((p, i) => ({
          cliente_id: user.id, conta_id: conta.id, titulo_arte: p.titulo, legenda: p.legenda,
          hashtags: p.hashtags, agendado_para: horario(1 + i * passo, HORAS[i % HORAS.length]), status,
        }))
      );
      if (error) throw error;
      resultado = "ger-ok";
    }
  } catch (e) {
    console.error("Erro ao gerar posts:", e);
  }
  redirect(`/painel?ig=${resultado}`);
}
