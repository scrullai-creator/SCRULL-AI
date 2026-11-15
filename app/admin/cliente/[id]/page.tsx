import Link from "next/link";
import { exigirAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { VerPost } from "../../../painel/ver-post";
import { Botao } from "../../../painel/botao";
import { statusDoPost } from "../../actions";

const TZ = "America/Sao_Paulo";
const dia = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ }); // AAAA-MM-DD
const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default async function Calendario({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string; d?: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  const { m, d } = await searchParams;
  const hoje = dia(new Date().toISOString());
  const mes = /^\d{4}-\d{2}$/.test(m ?? "") ? m! : (d ?? hoje).slice(0, 7);
  const [ano, nm] = mes.split("-").map(Number);
  const db = supabaseAdmin();
  const [{ data: cliente }, { data: posts }, { data: conta }] = await Promise.all([
    db.from("clientes").select("nome_empresa").eq("id", id).single(),
    db.from("posts").select("id, titulo_arte, legenda, hashtags, imagem_url, agendado_para, status, erro_msg").eq("cliente_id", id)
      .gte("agendado_para", new Date(Date.UTC(ano, nm - 1, 1) - 864e5).toISOString())
      .lte("agendado_para", new Date(Date.UTC(ano, nm, 1) + 864e5).toISOString()).order("agendado_para"),
    db.from("contas_instagram").select("ig_username").eq("cliente_id", id).eq("ativa", true).limit(1),
  ]);
  if (!cliente) return <main><p>Cliente não encontrado.</p><Link href="/admin">Voltar</Link></main>;

  const porDia = new Map<string, NonNullable<typeof posts>>();
  (posts ?? []).forEach((p) => { const k = dia(p.agendado_para); porDia.set(k, [...(porDia.get(k) ?? []), p]); });
  const primeiro = new Date(Date.UTC(ano, nm - 1, 1)).getUTCDay();
  const total = new Date(Date.UTC(ano, nm, 0)).getUTCDate();
  const ant = new Date(Date.UTC(ano, nm - 2, 1)).toISOString().slice(0, 7);
  const prox = new Date(Date.UTC(ano, nm, 1)).toISOString().slice(0, 7);
  const sel = d && d.startsWith(mes) ? d : (porDia.has(hoje) && hoje.startsWith(mes) ? hoje : [...porDia.keys()].filter((k) => k.startsWith(mes)).sort()[0] ?? "");
  const doDia = porDia.get(sel) ?? [];
  const cor: Record<string, string> = { aprovado: "var(--ok)", publicado: "var(--p)", aguardando_aprovacao: "#d9a400", recusado: "var(--mut)", erro: "var(--err)" };
  const nomeStatus: Record<string, string> = { aprovado: "Aprovado", publicado: "Publicado", aguardando_aprovacao: "Aguardando", recusado: "Recusado", erro: "Erro" };

  return (
    <>
      <header className="topo">
        <div className="logo"><img src="/mascote-pequeno.png" alt="" width={34} height={34} className="logo-img" />SCRULL<i>AI</i> <small style={{ fontWeight: 600, opacity: .7 }}>· dono</small></div>
        <Link className="btn sm ghost" href="/admin" style={{ color: "#fff", borderColor: "#ffffff55" }}>← Clientes</Link>
      </header>
      <main>
        <h1>{cliente.nome_empresa}</h1>
        <p className="sub">{conta?.[0] ? `@${conta[0].ig_username}` : "Instagram não conectado"} · calendário de posts</p>

        <div className="card">
          <div className="cal-topo">
            <Link className="btn sm ghost" href={`?m=${ant}`} aria-label="Mês anterior">‹</Link>
            <b>{NOMES[nm - 1]} de {ano}</b>
            <Link className="btn sm ghost" href={`?m=${prox}`} aria-label="Próximo mês">›</Link>
          </div>
          <div className="cal">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((x, i) => <span key={i} className="cal-sem">{x}</span>)}
            {Array.from({ length: primeiro }).map((_, i) => <span key={`v${i}`} />)}
            {Array.from({ length: total }).map((_, i) => {
              const k = `${mes}-${String(i + 1).padStart(2, "0")}`, ps = porDia.get(k);
              return (
                <Link key={k} href={`?m=${mes}&d=${k}`} className={`cal-dia${k === sel ? " sel" : ""}${k === hoje ? " hoje" : ""}`} aria-label={`Dia ${i + 1}${ps ? `, ${ps.length} post` : ""}`}>
                  {i + 1}
                  {ps && <i style={{ background: cor[ps[0].status] }} />}
                </Link>
              );
            })}
          </div>
        </div>

        <h2>{sel ? `Posts do dia ${sel.split("-").reverse().join("/")}` : "Sem posts neste mês"}</h2>
        {doDia.map((p) => (
          <div className="card ad-post" key={p.id}>
            <div className="ad-p-img">
              {p.imagem_url ? (
                <VerPost imagem={p.imagem_url} titulo={p.titulo_arte ?? ""} legenda={p.legenda} hashtags={p.hashtags ?? []} perfil={conta?.[0]?.ig_username} quando={new Date(p.agendado_para).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" })}>
                  {["aguardando_aprovacao", "recusado", "erro"].includes(p.status) && <form action={statusDoPost}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="aprovado" /><Botao className="btn">Aprovar este post</Botao></form>}
                  {["aguardando_aprovacao", "aprovado"].includes(p.status) && <form action={statusDoPost}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="recusado" /><Botao className="btn ghost">Recusar</Botao></form>}
                </VerPost>
              ) : <div className="arte"><b>{p.titulo_arte}</b></div>}
            </div>
            <div>
              <b>{p.titulo_arte}</b>
              <p className="ad-linha">{new Date(p.agendado_para).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })} · <span style={{ color: cor[p.status], fontWeight: 700 }}>{nomeStatus[p.status] ?? p.status}</span></p>
              <p style={{ margin: "6px 0 0", fontSize: 14 }}>{p.legenda.slice(0, 160)}{p.legenda.length > 160 ? "…" : ""}</p>
              {p.erro_msg && <p className="ad-linha" style={{ color: "var(--err)" }}>Erro: {p.erro_msg}</p>}
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
