// Fila de publicação: chamada a cada 15 minutos pelo agendador (pg_cron no Supabase).
// Publica os posts APROVADOS cuja hora já chegou, de clientes com assinatura ativa
// e sem "Pausar publicações" ligado. Se o post ainda não tem arte, cria antes.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { publicarPost, PostOcupado } from "@/lib/publicar";
import { registrar } from "@/lib/historico";
import { gerarArteDoPost } from "@/lib/imagem";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const POR_RODADA = 2;          // cada post leva até ~40 s (arte + publicação)
const ATRASO_MAXIMO_H = 24;    // não publica post que passou da hora há mais de um dia

async function rodar(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const agora = new Date();

  // Posts presos em "publicando" há mais de 10 minutos (a função caiu no meio): viram "erro" com um aviso.
  // Não tenta de novo sozinho; a nova tentativa confere no Instagram se o post chegou a sair.
  const presos = await db.from("posts").update({
    status: "erro", publicando_desde: null,
    erro_msg: "A publicação foi interrompida. Toque em \"Tentar de novo\": antes de publicar, a Scrull confere no Instagram se o post já saiu.",
  }).eq("status", "publicando").lt("publicando_desde", new Date(agora.getTime() - 10 * 60000).toISOString()).select("id, cliente_id");
  for (const p of presos.data ?? []) await registrar(p.id, p.cliente_id, "falhou", "publicação interrompida", "automático");

  const limite = new Date(agora.getTime() - ATRASO_MAXIMO_H * 3600 * 1000);
  const { data: fila, error } = await db.from("posts")
    .select("id, cliente_id, imagem_url, clientes!inner(assinatura), erro_msg")
    .eq("status", "aprovado")
    .eq("clientes.assinatura", "ativa")
    .lte("agendado_para", agora.toISOString())
    .gte("agendado_para", limite.toISOString())
    .order("agendado_para")
    .limit(10);
  if (error) {
    console.error("Fila de publicação: erro ao ler", error.message);
    return NextResponse.json({ erro: "falha ao ler a fila" }, { status: 500 });
  }

  // Clientes com as publicações pausadas ficam de fora
  const ids = [...new Set((fila ?? []).map((p) => p.cliente_id))];
  const { data: cfgs } = ids.length
    ? await db.from("configuracoes").select("cliente_id, pausado").in("cliente_id", ids)
    : { data: [] as { cliente_id: string; pausado: boolean }[] };
  const pausados = new Set((cfgs ?? []).filter((c) => c.pausado).map((c) => c.cliente_id));

  const resultado: { id: string; ok: boolean; motivo?: string }[] = [];
  for (const p of (fila ?? []).filter((p) => !pausados.has(p.cliente_id)).slice(0, POR_RODADA)) {
    try {
      if (!p.imagem_url) {
        await gerarArteDoPost(p.id, p.cliente_id);
        await registrar(p.id, p.cliente_id, "arte", "arte criada antes de publicar", "automático");
      }
      await publicarPost(p.id, p.cliente_id, "automático");
      resultado.push({ id: p.id, ok: true });
    } catch (e) {
      const motivo = e instanceof Error ? e.message : "erro";
      if (e instanceof PostOcupado) { resultado.push({ id: p.id, ok: false, motivo }); continue; }
      // Marca como erro para não tentar de novo a cada rodada; o cliente vê o motivo no painel
      // (a publicação já marca sozinha; aqui cobre a falha ao criar a arte)
      await db.from("posts").update({ status: "erro", erro_msg: motivo.slice(0, 300) }).eq("id", p.id).neq("status", "publicado");
      console.error("Fila de publicação: post", p.id, motivo);
      resultado.push({ id: p.id, ok: false, motivo });
    }
  }
  return NextResponse.json({ na_fila: fila?.length ?? 0, processados: resultado });
}

export const GET = rodar;
export const POST = rodar;
