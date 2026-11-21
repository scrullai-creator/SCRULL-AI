"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseDoUsuario, supabaseAdmin } from "@/lib/supabase";
import { criarPosts, reescreverLegenda } from "@/lib/gerar-posts";
import { lerPerfil, resumoDoPerfil } from "@/lib/instagram-leitura";
import { CAMPOS_BRIEFING, lerBriefing, type Briefing } from "@/lib/briefing";
import { gerarArteDoPost, guardarArquivo, LimiteDeArtes } from "@/lib/imagem";
import { publicarPost, PostOcupado } from "@/lib/publicar";
import { registrar } from "@/lib/historico";
import { criarAssinatura, cancelarAssinatura, pagamentoConfigurado } from "@/lib/mercadopago";

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
    db.from("posts").select("titulo_arte, tema, layout").eq("cliente_id", userId)
      .neq("status", "recusado").order("criado_em", { ascending: false }).limit(20),
  ]);
  const qtd = plano?.posts_por_semana ?? 7;
  // Lê o Instagram do cliente (se conectado) para manter a voz da marca e aprender com o que funciona
  const perfil = await lerPerfil(userId);
  const fotosDoPerfil = perfil.filter((p) => p.imagem).slice(0, 6).map((p) => p.imagem!) ;
  const lista = await criarPosts({
    perfil: resumoDoPerfil(perfil), fotosDoPerfil,
    empresa: cliente.nome_empresa, ramo: cliente.ramo, tom: cliente.tom_de_voz, quantidade: qtd,
    briefing: lerBriefing(cliente.briefing), temLogo: !!cliente.logo_url,
    historico: (recentes ?? []).map((p) => ({ titulo: p.titulo_arte ?? "", tema: p.tema, layout: p.layout })),
  });
  const passo = qtd >= 7 ? 1 : 2;
  const status = cfg?.postar_sem_aprovacao ? "aprovado" : "aguardando_aprovacao";
  const { data: criados, error } = await db.from("posts").insert(
    lista.map((p, i) => ({
      cliente_id: userId, conta_id: conta?.id ?? null, titulo_arte: p.titulo, topicos: p.topicos, tema: p.tema,
      layout: p.layout, subtitulo: p.subtitulo || null,
      legenda: p.legenda, hashtags: p.hashtags, prompt_imagem: p.prompt_imagem,
      agendado_para: horario(1 + i * passo, HORAS[i % HORAS.length]), status,
    }))
  ).select("id");
  if (error) throw error;
  await registrar((criados ?? []).map((p) => p.id), userId, "criado",
    status === "aprovado" ? "criado pela Scrull e aprovado automaticamente (postar sem aprovação ligado)" : "criado pela Scrull", "automático");
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
    await registrar(id, user.id, "arte", "nova arte criada");
    resultado = "img-ok";
  } catch (e) {
    if (e instanceof LimiteDeArtes) {
      resultado = "img-limite";
    } else {
      console.error("Erro ao gerar imagem:", e);
    }
  }
  revalidatePath("/painel");
  redirect(destino(f, resultado, id));
}

// Volta para a mesma aba/visão do painel, com o aviso e no mesmo post
function destino(f: FormData, aviso: string, id: string) {
  const vista = String(f.get("vista") ?? "");
  const q = new URLSearchParams(vista.startsWith("?") ? vista.slice(1) : vista);
  q.set("ig", aviso);
  return `/painel?${q}#post-${id}`;
}

// Editar o título (e o subtítulo) da arte. Se o post já tem arte e ainda há trocas, a arte é refeita
// com o texto novo (conta como uma troca); sem trocas, o texto fica salvo para a próxima arte.
export async function salvarTitulo(f: FormData) {
  const { user } = await usuarioLogado();
  const id = String(f.get("id") ?? "");
  const titulo = String(f.get("titulo") ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const subtitulo = String(f.get("subtitulo") ?? "").replace(/\s+/g, " ").trim().slice(0, 90);
  let resultado = "tit-erro";
  try {
    if (!titulo) throw new Error("título vazio");
    const db = supabaseAdmin();
    const { data } = await db.from("posts").update({ titulo_arte: titulo, subtitulo: subtitulo || null })
      .eq("id", id).eq("cliente_id", user.id).in("status", ["aguardando_aprovacao", "aprovado", "recusado", "erro"])
      .select("id, imagem_url");
    if (!data?.length) throw new Error("post não pode ser alterado");
    await registrar(id, user.id, "titulo", `"${titulo}"`);
    resultado = "tit-ok";
    if (data[0].imagem_url) {
      try {
        await gerarArteDoPost(id, user.id);
        await registrar(id, user.id, "arte", "refeita com o título novo");
        resultado = "tit-ok-arte";
      } catch (e) {
        resultado = e instanceof LimiteDeArtes ? "tit-ok-limite" : "tit-ok-sem-arte";
        if (!(e instanceof LimiteDeArtes)) console.error("Erro ao refazer a arte com o título novo:", e);
      }
    }
  } catch (e) {
    console.error("Erro ao salvar o título:", e);
  }
  revalidatePath("/painel");
  redirect(destino(f, resultado, id));
}

// Publicar agora no Instagram (só assinantes) -------------------------------
export async function publicarAgora(f: FormData) {
  const { user } = await usuarioLogado();
  const id = String(f.get("id") ?? "");
  let resultado = "pub-erro";
  try {
    const db = supabaseAdmin();
    const { data: c } = await db.from("clientes").select("assinatura").eq("id", user.id).single();
    if (c?.assinatura !== "ativa") {
      resultado = "pub-assine";
    } else if (f.get("confirmado") !== "sim") {
      resultado = "pub-confirmar";
    } else {
      await publicarPost(id, user.id);
      resultado = "pub-ok";
    }
  } catch (e) {
    if (e instanceof PostOcupado) resultado = "pub-ocupado";
    else console.error("Erro ao publicar:", e);
  }
  revalidatePath("/painel");
  redirect(destino(f, resultado, id));
}

// Assinatura ------------------------------------------------------------------
export async function assinar(f: FormData) {
  const { user } = await usuarioLogado();
  const planoId = String(f.get("plano") ?? "");
  let destino = "/painel?ig=assin-erro";
  if (!pagamentoConfigurado()) {
    destino = "/painel?ig=assin-breve";
  } else {
    try {
      destino = await criarAssinatura({ clienteId: user.id, email: user.email ?? "", planoId });
    } catch (e) {
      console.error("Erro ao criar assinatura:", e);
    }
  }
  redirect(destino);
}

export async function cancelar() {
  const { user } = await usuarioLogado();
  let resultado = "cancel-erro";
  try {
    await cancelarAssinatura(user.id);
    resultado = "cancel-ok";
  } catch (e) {
    console.error("Erro ao cancelar assinatura:", e);
  }
  revalidatePath("/painel");
  redirect(`/painel?ig=${resultado}`);
}

// Reescreve a legenda de um post com a IA (texto mais humano). Até 3 vezes por post por dia.
const reescritas = new Map<string, { dia: string; n: number }>();
export async function reescreverLegendaPost(f: FormData) {
  const { s, user } = await usuarioLogado();
  const id = String(f.get("id") ?? "");
  let resultado = "leg-erro";
  console.log("[legenda] início", id);
  try {
    const dia = new Date().toISOString().slice(0, 10);
    const r = reescritas.get(id);
    if (r && r.dia === dia && r.n >= 3) {
      resultado = "leg-limite";
    } else {
      const [{ data: post }, { data: c }] = await Promise.all([
        s.from("posts").select("tema, titulo_arte, legenda, status").eq("id", id).eq("cliente_id", user.id).single(),
        s.from("clientes").select("nome_empresa, ramo, tom_de_voz, briefing").eq("id", user.id).single(),
      ]);
      console.log("[legenda] post lido:", !!post, "cliente lido:", !!c, "status:", post?.status);
      if (post && c && post.status !== "publicado") {
        const novo = await reescreverLegenda({
          empresa: c.nome_empresa, ramo: c.ramo ?? "", tom: c.tom_de_voz ?? "", briefing: lerBriefing(c.briefing),
          tema: post.tema ?? "", titulo: post.titulo_arte ?? "", legendaAtual: post.legenda ?? "",
        });
        console.log("[legenda] IA respondeu", novo.legenda.length, "caracteres");
        const { error: errUp, data: upd } = await s.from("posts").update({ legenda: novo.legenda, hashtags: novo.hashtags }).eq("id", id).eq("cliente_id", user.id).select("id");
        console.log("[legenda] gravou:", upd?.length ?? 0, "linha(s)", errUp ? `erro: ${errUp.message}` : "");
        if (errUp || !upd?.length) throw new Error("Não consegui gravar a nova legenda");
        reescritas.set(id, { dia, n: (r && r.dia === dia ? r.n : 0) + 1 });
        await registrar(id, user.id, "legenda", "reescrita pela IA");
        resultado = "leg-ok";
      }
    }
  } catch (e) {
    console.error("Erro ao reescrever legenda:", e);
  }
  revalidatePath("/painel");
  redirect(destino(f, resultado, id));
}
