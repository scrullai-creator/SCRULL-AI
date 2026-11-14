"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseDoUsuario, supabaseAdmin } from "@/lib/supabase";
import { criarPosts } from "@/lib/gerar-posts";
import { CAMPOS_BRIEFING, lerBriefing, type Briefing } from "@/lib/briefing";
import { gerarArteDoPost, guardarArquivo, LimiteDeArtes } from "@/lib/imagem";

const HORAS = ["19:00", "12:00", "11:30", "18:30", "19:00", "12:30", "19:00"];

function horario(dias: number, hhmm: string) {
  const dia = new Date(Date.now() + dias * 86400000)
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${dia}T${hhmm}:00-03:00`).toISOString();
}

async function usuarioLogado() {
  const s = await supabaseDoUsuario();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect("/login");
  return { s, user };
}

// Perfil + briefing da marca + logo ---------------------------------------
export async function salvarPerfil(f: FormData) {
  const { s, user } = await usuarioLogado();
  const ramo = String(f.get("ramo") ?? "").trim().slice(0, 120);
  const tom = String(f.get("tom") ?? "").trim().slice(0, 60);
  const briefing: Briefing = {};
  for (const { chave } of CAMPOS_BRIEFING) {
    const v = String(f.get(`briefing_${chave}`) ?? "").trim().slice(0, 1200);
    if (v) briefing[chave] = v;
  }

  const dados: Record<string, unknown> = { briefing };
  if (ramo) dados.ramo = ramo;
  if (tom) dados.tom_de_voz = tom;

  // Logo: PNG ou JPG até 2 MB, guardada na pasta pública
  const logo = f.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const tipo = logo.type === "image/png" ? "png" : logo.type === "image/jpeg" ? "jpg" : null;
    if (tipo && logo.size <= 2 * 1024 * 1024) {
      const url = await guardarArquivo(`${user.id}/logo.${tipo}`, await logo.arrayBuffer(), logo.type);
      dados.logo_url = `${url}?v=${Date.now()}`;
    }
  }

  const { error } = await s.from("clientes").update(dados).eq("id", user.id);
  if (error) console.error("Erro ao salvar perfil:", error.message);
  revalidatePath("/painel");
  redirect(`/painel?ig=${error ? "perfil-erro" : "perfil-ok"}`);
}

// Posts da semana -----------------------------------------------------------
async function gerar(userId: string, db = supabaseAdmin()): Promise<string> {
  const { data: cliente } = await db.from("clientes")
    .select("nome_empresa, ramo, tom_de_voz, plano_id, briefing, logo_url, assinatura").eq("id", userId).single();
  if (!cliente?.ramo) throw new Error("Perfil incompleto");
  // O Instagram só é obrigatório para publicar; a demonstração funciona sem ele
  const { data: conta } = await db.from("contas_instagram").select("id")
    .eq("cliente_id", userId).eq("ativa", true).limit(1).maybeSingle();

  // Demonstração: quem ainda não assinou cria uma semana só
  if (cliente.assinatura !== "ativa") {
    const { count: jaCriou } = await db.from("posts").select("id", { count: "exact", head: true }).eq("cliente_id", userId);
    if ((jaCriou ?? 0) > 0) return "demo-usada";
  }

  // Economia: no máximo uma geração a cada 12 horas por cliente (posts recusados não contam)
  const desde = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { count } = await db.from("posts").select("id", { count: "exact", head: true })
    .eq("cliente_id", userId).neq("status", "recusado").gte("criado_em", desde);
  if ((count ?? 0) > 0) return "ger-cedo";

  const [{ data: plano }, { data: cfg }, { data: recentes }] = await Promise.all([
    db.from("planos").select("posts_por_semana").eq("id", cliente.plano_id).single(),
    db.from("configuracoes").select("postar_sem_aprovacao").eq("cliente_id", userId).single(),
    db.from("posts").select("titulo_arte, tema").eq("cliente_id", userId)
      .neq("status", "recusado").order("criado_em", { ascending: false }).limit(20),
  ]);
  const qtd = plano?.posts_por_semana ?? 7;
  const lista = await criarPosts({
    empresa: cliente.nome_empresa, ramo: cliente.ramo, tom: cliente.tom_de_voz, quantidade: qtd,
    briefing: lerBriefing(cliente.briefing), temLogo: !!cliente.logo_url,
    historico: (recentes ?? []).map((p) => ({ titulo: p.titulo_arte ?? "", tema: p.tema })),
  });
  const passo = qtd >= 7 ? 1 : 2;
  const status = cfg?.postar_sem_aprovacao ? "aprovado" : "aguardando_aprovacao";
  const { error } = await db.from("posts").insert(
    lista.map((p, i) => ({
      cliente_id: userId, conta_id: conta?.id ?? null, titulo_arte: p.titulo, topicos: p.topicos, tema: p.tema,
      legenda: p.legenda, hashtags: p.hashtags, prompt_imagem: p.prompt_imagem,
      agendado_para: horario(1 + i * passo, HORAS[i % HORAS.length]), status,
    }))
  );
  if (error) throw error;
  return "ger-ok";
}

export async function gerarSemana() {
  const { user } = await usuarioLogado();
  let resultado = "ger-erro";
  try {
    resultado = await gerar(user.id);
  } catch (e) {
    console.error("Erro ao gerar posts:", e);
  }
  redirect(`/painel?ig=${resultado}`);
}

// Apaga os posts ainda não aprovados (aguardando ou recusados) e cria a semana de novo
export async function refazerSemana() {
  const { user } = await usuarioLogado();
  let resultado = "ger-erro";
  try {
    const db = supabaseAdmin();
    const { data: c } = await db.from("clientes").select("assinatura").eq("id", user.id).single();
    if (c?.assinatura !== "ativa") {
      resultado = "demo-usada";
    } else {
      await db.from("posts").delete().eq("cliente_id", user.id).in("status", ["aguardando_aprovacao", "recusado"]);
      resultado = await gerar(user.id, db);
    }
  } catch (e) {
    console.error("Erro ao refazer posts:", e);
  }
  redirect(`/painel?ig=${resultado}`);
}

// Arte de um post -----------------------------------------------------------
export async function gerarImagemPost(f: FormData) {
  const { user } = await usuarioLogado();
  const id = String(f.get("id") ?? "");
  let resultado = "img-erro";
  try {
    await gerarArteDoPost(id, user.id);
    resultado = "img-ok";
  } catch (e) {
    if (e instanceof LimiteDeArtes) {
      resultado = "img-limite";
    } else {
      console.error("Erro ao gerar imagem:", e);
    }
  }
  revalidatePath("/painel");
  redirect(`/painel?ig=${resultado}#post-${id}`);
}
