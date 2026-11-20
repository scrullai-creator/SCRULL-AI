import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { contarArtes } from "@/lib/imagem";
import { mudarAssinatura } from "./actions";
import { sair } from "../painel/actions";
import { Botao } from "../painel/botao";

export const maxDuration = 60;
const CUSTO_ARTE = 0.25; // R$ por arte (estimativa)
const reais = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function Admin({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await exigirAdmin();
  const { f } = await searchParams;
  const db = supabaseAdmin();
  const [{ data: clientes }, { data: posts }, { data: contas }, { data: planos }] = await Promise.all([
    db.from("clientes").select("id, nome_empresa, ramo, assinatura, plano_id, criado_em").order("criado_em"),
    db.from("posts").select("cliente_id, status, agendado_para"),
    db.from("contas_instagram").select("cliente_id, ig_username").eq("ativa", true),
    db.from("planos").select("id, nome, preco_centavos"),
  ]);
  const agora = Date.now();
  const artes: Record<string, number> = Object.fromEntries(await Promise.all((clientes ?? []).map(async (c) =>
    [c.id, await contarArtes(c.id).then((a) => a.noMes).catch(() => 0)] as const)));

  const por = (id: string) => (posts ?? []).filter((p) => p.cliente_id === id);
  const ativos = (clientes ?? []).filter((c) => c.assinatura === "ativa").length;
  const agendados = (posts ?? []).filter((p) => p.status === "aprovado" && new Date(p.agendado_para).getTime() > agora).length;
  const publicados = (posts ?? []).filter((p) => p.status === "publicado").length;
  const totalArtes = Object.values(artes).reduce((a, b) => a + b, 0);
  const receita = (clientes ?? []).filter((c) => c.assinatura === "ativa")
    .reduce((s, c) => s + (planos?.find((p) => p.id === c.plano_id)?.preco_centavos ?? 0), 0) / 100;

  return (
    <>
      <header className="topo">
        <div className="logo"><img src="/mascote-pequeno.png" alt="" width={34} height={34} className="logo-img" />SCRULL<i>AI</i> <small style={{ fontWeight: 600, opacity: .7 }}>· dono</small></div>
        <span style={{ display: "flex", gap: 8 }}><Link className="btn sm ghost" href="/painel" style={{ color: "#fff", borderColor: "#ffffff55" }}>Meu painel</Link><form action={sair}><Botao className="btn sm ghost" style={{ color: "#fff", borderColor: "#ffffff55" }}>Sair</Botao></form></span>
      </header>
      <main>
        <h1>Meus clientes</h1>
        <p className="sub">Visão geral do Scrull AI. As artes e os custos são estimativas.</p>

        <div className="ad-nums">
          <div className="card"><b>{ativos}</b><span>clientes ativos</span></div>
          <div className="card"><b>{agendados}</b><span>posts agendados</span></div>
          <div className="card"><b>{publicados}</b><span>posts publicados</span></div>
          <div className="card"><b>{totalArtes}</b><span>artes no mês</span></div>
          <div className="card"><b>{reais(totalArtes * CUSTO_ARTE)}</b><span>custo de IA no mês (~R$ 0,25 por arte)</span></div>
          <div className="card"><b>{reais(receita)}</b><span>mensalidades ativas (pilotos sem cobrança incluídos)</span></div>
        </div>

        <nav className="filtros" aria-label="Filtrar clientes">
          {[["", "Todos os clientes"], ["pendencias", "Com posts aguardando aprovação"], ["falhas", "Com falhas"]].map(([k, r]) => {
            const n = (clientes ?? []).filter((c) => !k || por(c.id).some((p) => p.status === (k === "falhas" ? "erro" : "aguardando_aprovacao"))).length;
            return <Link key={k} href={k ? `?f=${k}` : "/admin"} className={`filtro${(f ?? "") === k ? " ativo" : ""}`}>{r} <b>{n}</b></Link>;
          })}
        </nav>

        {(clientes ?? []).filter((c) => !f || por(c.id).some((p) => p.status === (f === "falhas" ? "erro" : "aguardando_aprovacao"))).map((c) => {
          const meus = por(c.id), ig = contas?.find((x) => x.cliente_id === c.id);
          return (
            <div className="card ad-cli" key={c.id}>
              <div className="ad-topo">
                <div>
                  <h2 style={{ margin: 0 }}>{c.nome_empresa}</h2>
                  <small>{c.ramo ?? "ramo não informado"} · {ig ? `@${ig.ig_username}` : "Instagram não conectado"}</small>
                </div>
                <span className={`badge ${c.assinatura === "ativa" ? "ok" : "cinza"}`}>{c.assinatura}</span>
              </div>
              <p className="ad-linha">
                {meus.length} posts · {meus.filter((p) => p.status === "aguardando_aprovacao").length} aguardando · {meus.filter((p) => p.status === "aprovado" && new Date(p.agendado_para).getTime() > agora).length} agendados · {meus.filter((p) => p.status === "publicado").length} publicados
                {meus.some((p) => p.status === "erro") && <b style={{ color: "var(--err)" }}> · {meus.filter((p) => p.status === "erro").length} com falha</b>} · {artes[c.id] ?? 0} artes no mês
              </p>
              <div className="ad-acoes">
                <Link className="btn sm" href={`/admin/cliente/${c.id}`}>Ver calendário</Link>
                {["ativa", "teste", "cancelada"].filter((s) => s !== c.assinatura).map((s) => (
                  <form key={s} action={mudarAssinatura}>
                    <input type="hidden" name="id" value={c.id} /><input type="hidden" name="status" value={s} />
                    <Botao className="btn sm ghost">{s === "ativa" ? "Ativar (sem cobrança)" : s === "teste" ? "Voltar p/ teste" : "Cancelar"}</Botao>
                  </form>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </>
  );
}
