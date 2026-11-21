import { ManterPosicao } from "./manter-posicao";
import { redirect } from "next/navigation";
import { gerarSemana, refazerSemana, salvarPerfil, assinar, cancelar } from "./gerar";
import { supabaseDoUsuario } from "@/lib/supabase";
import { CAMPOS_BRIEFING, lerBriefing } from "@/lib/briefing";
import { ARTES_POR_POST, ARTES_DEMO, contarArtes, limiteMensal } from "@/lib/imagem";
import { CartaoPost, type Historico } from "./cartao-post";
import { situacao, passaNoFiltro, FILTROS, type Filtro } from "@/lib/status-post";
import Link from "next/link";
import { Botao } from "./botao";
import { EnviarFotos } from "./enviar-fotos";
import { apagarFoto } from "./fotos";
import { listarFotos, MAX_FOTOS } from "@/lib/fotos";
import { aprovarTodos, alternarConfig, sair } from "./actions";

// Gerar a arte pode levar até ~60 s (arte da IA + plano B com o texto escrito pelo app)
export const maxDuration = 120;

const AVISOS: Record<string, [string, boolean]> = {
  ok: ["Instagram conectado! Já podemos criar seus posts.", true],
  "ger-ok": ["Posts criados! Revise, crie as artes e aprove cada um.", true],
  "ger-cedo": ["Seus posts da semana já foram criados. Para criar outros, use \"Refazer a semana\".", false],
  "ger-erro": ["Não foi possível criar os posts agora. Tente de novo em instantes.", false],
  "img-ok": ["Arte criada! Se não gostar, é só gerar outra.", true],
  "img-erro": ["Não foi possível criar a arte agora. Tente de novo em instantes.", false],
  "pub-ok": ["Publicado! O Instagram confirmou a publicação.", true],
  "pub-ocupado": ["Este post já está sendo publicado (ou já foi). Nada foi enviado de novo.", false],
  "pub-confirmar": ["Confirme a publicação no próprio post para ele ir ao ar.", false],
  "aprov-ok": ["Aprovado! O post está agendado e sai sozinho na data marcada.", true],
  "aprov-todos": ["Posts aprovados e agendados.", true],
  "leg-salva": ["Legenda salva.", true],
  "tit-ok": ["Título salvo. Ele entra na arte quando ela for criada.", true],
  "tit-ok-arte": ["Título salvo e arte refeita com o texto novo.", true],
  "tit-ok-limite": ["Título salvo, mas este post não tem mais trocas de arte. O texto novo entra se uma nova arte for criada.", false],
  "tit-ok-sem-arte": ["Título salvo, mas não deu para refazer a arte agora. Toque em \"Trocar a arte\" em instantes.", false],
  "tit-erro": ["Não foi possível salvar o título. Escreva um título e tente de novo.", false],
  "hora-ok": ["Data e horário atualizados.", true],
  "hora-erro": ["Escolha uma data pelo menos 5 minutos à frente (e em até 4 meses).", false],
  "leg-ok": ["Legenda reescrita! Se ainda não gostar, pode pedir outra ou editar à mão.", true],
  "leg-erro": ["Não foi possível reescrever a legenda agora. Tente de novo em instantes.", false],
  "leg-limite": ["Você já reescreveu esta legenda 3 vezes hoje. Edite à mão ou tente amanhã.", false],
  "pub-erro": ["Não foi possível publicar agora. Veja o motivo no post e tente de novo.", false],
  "pub-assine": ["Assine para ter a criação de artes e a postagem automatizada, sem esforço e sem gastar seu tempo.", false],
  "assin-ok": ["Assinatura confirmada! A Scrull já pode publicar para você.", true],
  "assin-pendente": ["Estamos aguardando a confirmação do pagamento. Assim que o Mercado Pago confirmar, sua conta é ativada.", false],
  "assin-erro": ["Não foi possível abrir o pagamento agora. Tente de novo em instantes.", false],
  "assin-breve": ["A assinatura online estará disponível em breve. Fale com a gente para ativar o seu plano.", false],
  "cancel-ok": ["Assinatura cancelada. Seus posts ficam guardados caso você volte.", true],
  "cancel-erro": ["Não foi possível cancelar agora. Tente de novo em instantes.", false],
  "demo-usada": ["Sua semana grátis já foi criada. Assine para criar novas semanas, liberar todas as artes e publicar.", false],
  "img-limite": [`Limite de artes atingido: cada post pode ser trocado até ${ARTES_POR_POST - 1} vezes, e há um limite mensal no seu plano. Edite a legenda ou aprove uma das artes já criadas.`, false],
  "perfil-ok": ["Briefing salvo! Agora a Scrull conhece a sua marca.", true],
  "perfil-erro": ["Não foi possível salvar o briefing. Tente de novo.", false],
  negado: ["Você cancelou a conexão. Quando quiser, é só tentar de novo.", false],
  erro: ["Não foi possível conectar agora. Tente de novo em instantes.", false],
  "sem-conta": ["Nenhuma conta do Instagram foi compartilhada. Conecte de novo e selecione a conta da sua empresa.", false],
  "conta-pessoal": ["Essa conta é pessoal. Mude para Comercial ou Criador nas configurações do Instagram e conecte de novo.", false],
};

const TZ = "America/Sao_Paulo";
const diaDe = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ }); // AAAA-MM-DD
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PERIODOS: Record<string, string> = { tudo: "Qualquer data", "7": "Próximos 7 dias", "30": "Próximos 30 dias", passados: "Já passaram" };

const TONS = ["Próximo e acolhedor", "Divertido e descontraído", "Elegante e sofisticado", "Direto e profissional"];

function Chave(p: { campo: string; valor: boolean; titulo: string; descricao: string }) {
  return (
    <form action={alternarConfig} className="linha">
      <div>{p.titulo}<small>{p.descricao}</small></div>
      <input type="hidden" name="campo" value={p.campo} />
      <input type="hidden" name="valor" value={String(p.valor)} />
      <button className="chave" role="switch" aria-checked={p.valor} aria-label={p.titulo} />
    </form>
  );
}

type Busca = { ig?: string; f?: string; ver?: string; periodo?: string; m?: string; d?: string };

export default async function Painel({ searchParams }: { searchParams: Promise<Busca> }) {
  const busca = await searchParams;
  const { ig } = busca;
  const filtro: Filtro = (busca.f && busca.f in FILTROS ? busca.f : "ativos") as Filtro;
  const calendario = busca.ver === "calendario";
  const periodo = busca.periodo && busca.periodo in PERIODOS ? busca.periodo : "tudo";
  const agoraMs = Date.now();
  const hoje = diaDe(new Date(agoraMs).toISOString());
  const mes = /^\d{4}-\d{2}$/.test(busca.m ?? "") ? busca.m! : (busca.d ?? hoje).slice(0, 7);
  const [anoCal, mesCal] = mes.split("-").map(Number);
  // Janela de posts: lista = 60 dias para trás e 120 para frente; calendário = o mês escolhido
  const desde = calendario ? new Date(Date.UTC(anoCal, mesCal - 1, 1) - 864e5) : new Date(agoraMs - 60 * 864e5);
  const ate = calendario ? new Date(Date.UTC(anoCal, mesCal, 1) + 864e5) : new Date(agoraMs + 120 * 864e5);
  const supabase = await supabaseDoUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: cliente }, { data: cfg }, { data: contas }, { data: posts }, { data: planos }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", user.id).single(),
    supabase.from("configuracoes").select("*").eq("cliente_id", user.id).single(),
    supabase.from("contas_instagram").select("id, ig_username")
      .eq("cliente_id", user.id).eq("ativa", true).limit(1),
    supabase.from("posts").select("*").eq("cliente_id", user.id)
      .gte("agendado_para", desde.toISOString()).lte("agendado_para", ate.toISOString())
      .order("agendado_para").limit(300),
    supabase.from("planos").select("id, nome, preco_centavos, preco_cheio_centavos, posts_por_semana").eq("ativo", true).order("preco_centavos"),
  ]);
  const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const ehDono = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((e) => e.trim()).includes((user.email ?? "").toLowerCase());
  const fotos = await listarFotos(user.id).catch(() => []);
  const conta = contas?.[0];
  // Página do Facebook (consulta separada: se a migração 9 ainda não rodou, só não aparece)
  const { data: fb } = conta
    ? await supabase.from("contas_instagram").select("fb_page_id, fb_page_nome").eq("id", conta.id).maybeSingle()
    : { data: null };
  const paginaFb = fb?.fb_page_id ? (fb.fb_page_nome || "sua Página") : null;
  const semArtes = { porPost: {} as Record<string, number>, noMes: 0, proximaVaga: null as string | null };
  const artes = posts?.length ? await contarArtes(user.id).catch(() => semArtes) : semArtes;
  const aviso = ig ? AVISOS[ig] : undefined;
  const briefing = lerBriefing(cliente?.briefing);
  const briefingPreenchido = Object.keys(briefing).length > 0;
  const assinante = cliente?.assinatura === "ativa";
  const quando = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      weekday: "short", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
    });
  const pendentes = posts?.filter((p) => p.status === "aguardando_aprovacao").length ?? 0;
  const semArte = posts?.filter((p) => !p.imagem_url && !["recusado", "publicado"].includes(p.status) && new Date(p.agendado_para).getTime() > agoraMs).length ?? 0;

  const temFuturos = (posts ?? []).some((p) => p.status !== "recusado" && new Date(p.agendado_para).getTime() > agoraMs);
  // Situação real de cada post e filtros (status + período)
  const ctx = { assinante, pausado: !!cfg?.pausado, temConta: !!conta, agora: agoraMs };
  const comSit = (posts ?? []).map((p) => ({ p, sit: situacao(p, ctx) }));
  const contagem = Object.fromEntries((Object.keys(FILTROS) as Filtro[]).map((f) => [f, comSit.filter((x) => passaNoFiltro(x.sit, f)).length]));
  const noPeriodo = (iso: string) => {
    const t = new Date(iso).getTime();
    if (periodo === "7") return t >= agoraMs - 3600000 && t <= agoraMs + 7 * 864e5;
    if (periodo === "30") return t >= agoraMs - 3600000 && t <= agoraMs + 30 * 864e5;
    if (periodo === "passados") return t < agoraMs;
    return true;
  };
  const filtrados = comSit.filter((x) => passaNoFiltro(x.sit, filtro) && (calendario || noPeriodo(x.p.agendado_para)));
  // Lista: pendências primeiro (o que precisa do cliente), depois por data; publicados do mais novo para o mais antigo
  const peso = (k: string) => (["falhou", "pendente", "aprovado_parado"].includes(k) ? 0 : 1);
  const lista = calendario ? [] : [...filtrados].sort((a, b) =>
    filtro === "publicados" || periodo === "passados"
      ? b.p.agendado_para.localeCompare(a.p.agendado_para)
      : peso(a.sit.chave) - peso(b.sit.chave) || a.p.agendado_para.localeCompare(b.p.agendado_para));
  // Calendário
  const porDia = new Map<string, typeof filtrados>();
  filtrados.forEach((x) => { const k = diaDe(x.p.agendado_para); porDia.set(k, [...(porDia.get(k) ?? []), x]); });
  const diaSel = calendario ? (busca.d && busca.d.startsWith(mes) ? busca.d : porDia.has(hoje) && hoje.startsWith(mes) ? hoje : [...porDia.keys()].sort()[0] ?? "") : "";
  const mostrados = calendario ? porDia.get(diaSel) ?? [] : lista;
  // Histórico dos posts mostrados (sem a migração 11, fica vazio)
  const { data: hist } = mostrados.length
    ? await supabase.from("post_historico").select("post_id, acao, detalhe, quem, em").in("post_id", mostrados.map((x) => x.p.id)).order("em", { ascending: false }).limit(400)
    : { data: [] as Historico[] };
  const limiteMes = limiteMensal(planos?.find((pl) => pl.id === cliente?.plano_id)?.posts_por_semana);
  // Endereço da visão atual (para os botões voltarem para a mesma aba)
  const link = (mudar: Partial<Busca>) => {
    const q = new URLSearchParams();
    const v = { f: filtro, ver: calendario ? "calendario" : undefined, periodo: periodo === "tudo" ? undefined : periodo, m: calendario ? mes : undefined, d: diaSel || undefined, ...mudar };
    for (const [k, val] of Object.entries(v)) if (val && k !== "ig") q.set(k, val);
    return `?${q}`;
  };
  const vista = link({});
  const corDia: Record<string, string> = { pendente: "#d9a400", falhou: "var(--err)", aprovado_parado: "#d9a400", agendado: "#2563eb", na_fila: "#2563eb", publicando: "#2563eb", publicado: "var(--ok)", recusado: "var(--mut)", rascunho: "var(--mut)" };

  return (
    <>
      <ManterPosicao />
      <header className="topo">
        <div className="logo"><img src="/mascote-pequeno.png" alt="" width={34} height={34} className="logo-img" />SCRULL<i>AI</i></div>
        <span style={{ display: "flex", gap: 8 }}>
          {ehDono && <a className="btn sm ghost" href="/admin" style={{ color: "#fff", borderColor: "#ffffff55" }}>Administração</a>}
          <form action={sair}><Botao className="btn sm ghost" style={{ color: "#fff", borderColor: "#ffffff55" }}>Sair</Botao></form>
        </span>
      </header>
      <main>
        <div className="saudacao">
          <img src="/mascote.png" alt="" width={84} height={84} />
          <div>
            <h1>Olá, {cliente?.nome_empresa ?? "bem-vinda"}!</h1>
            <p className="sub">
              {assinante ? "Sua assinatura está ativa." : `Demonstração grátis: crie sua primeira semana de posts e veja ${ARTES_DEMO} artes. Assine para publicar.`}
            </p>
          </div>
        </div>

        {aviso && <div className={`aviso ${aviso[1] ? "ok" : ""}`} role="status">{aviso[0]}</div>}

        <div className="card hero">
          {conta ? (
            <>
              <span className="badge ok">Conectado</span>
              <p style={{ margin: "12px 0 0" }}>Perfil @{conta.ig_username} pronto para receber os posts.</p>
              {paginaFb ? (
                <p className="sub" style={{ margin: "6px 0 0" }}>Facebook: os posts saem também na Página {paginaFb}.</p>
              ) : (
                <p className="sub" style={{ margin: "6px 0 0" }}>
                  Quer que os posts saiam também no Facebook? <a href="/api/instagram/connect">Conecte de novo</a> e marque a Página do Facebook da sua empresa.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 style={{ margin: "0 0 6px" }}>Conecte seu Instagram</h2>
              <p>Um clique, sem digitar a senha. A conta precisa ser Comercial ou Criador.</p>
              <a className="btn ig" href="/api/instagram/connect">Conectar com Instagram</a>
            </>
          )}
        </div>

        {!assinante && !!posts?.length && (
          <>
            <h2>Assine e deixe no automático</h2>
            <div className="card">
              <p className="sub" style={{ marginTop: 0 }}>
                Assine para ter a criação de artes e a postagem automatizada, sem esforço e sem gastar seu tempo. Sem fidelidade: cancele quando quiser.
              </p>
              <div className="planos">
                {(planos ?? []).map((pl) => (
                  <form action={assinar} className="plano" key={pl.id}>
                    <input type="hidden" name="plano" value={pl.id} />
                    <b>{pl.nome}</b>
                    <span className="preco">
                      {pl.preco_cheio_centavos ? <s>{reais(pl.preco_cheio_centavos)}</s> : null} {reais(pl.preco_centavos)}<small>/mês</small>
                    </span>
                    <small>{pl.posts_por_semana >= 7 ? "1 post por dia, todos os dias" : `${pl.posts_por_semana} posts por semana`}</small>
                    <Botao className="btn">Assinar {pl.nome}</Botao>
                  </form>
                ))}
              </div>
              <small className="dica">Pague no cartão de crédito, com segurança pelo Mercado Pago. O Scrull não vê os dados do seu cartão. Cancele quando quiser.</small>
            </div>
          </>
        )}

        {(
          <>
            <h2>Sua marca</h2>
            <details className="card" open={!cliente?.ramo || !briefingPreenchido}>
              <summary>
                {briefingPreenchido ? "Editar briefing da marca" : "Preencher briefing da marca"}
                {cliente?.logo_url && <img src={cliente.logo_url} alt="" className="logo-mini" />}
              </summary>
              <p className="sub" style={{ marginTop: 10 }}>
                Quanto mais a Scrull souber sobre a sua empresa, mais os posts parecem feitos por quem conhece o negócio.
              </p>
              <form action={salvarPerfil}>
                <label htmlFor="ramo">O que a sua empresa vende?</label>
                <input id="ramo" name="ramo" className="campo" defaultValue={cliente?.ramo ?? ""}
                  placeholder="Ex.: loja de roupas, oficina de motos, salão" required maxLength={120} />
                <label htmlFor="tom">Como você quer falar com seus clientes?</label>
                <select id="tom" name="tom" className="campo" defaultValue={cliente?.tom_de_voz ?? TONS[0]}>
                  {TONS.map((t) => <option key={t}>{t}</option>)}
                </select>
                {CAMPOS_BRIEFING.map(({ chave, rotulo, dica, linhas }) => (
                  <div key={chave}>
                    <label htmlFor={`b-${chave}`}>{rotulo} <small className="dica">{dica}</small></label>
                    <textarea id={`b-${chave}`} name={`briefing_${chave}`} className="campo" rows={linhas}
                      defaultValue={briefing[chave] ?? ""} maxLength={1200} />
                  </div>
                ))}
                <label htmlFor="logo">Logo da empresa <small className="dica">PNG ou JPG, até 2 MB. Aparece em todas as artes.</small></label>
                <input id="logo" name="logo" type="file" accept="image/png,image/jpeg" className="campo" />
                <Botao className="btn">Salvar briefing</Botao>
              </form>
            </details>
            <div className="card">
              <b>Suas fotos</b>
              <p className="sub" style={{ margin: "6px 0 10px" }}>
                Envie fotos reais do seu produto, prato, loja ou equipe (até {MAX_FOTOS}). A Scrull usa as suas fotos nas artes, com luz e nitidez melhoradas, e sem inventar nada no produto.
              </p>
              {fotos.length > 0 && (
                <div className="fotos">
                  {fotos.map((f) => (
                    <form key={f.nome} action={apagarFoto} className="foto">
                      <img src={f.url} alt="Foto enviada" loading="lazy" />
                      <input type="hidden" name="nome" value={f.nome} />
                      <Botao className="btn sm ghost" aria-label="Remover foto">Remover</Botao>
                    </form>
                  ))}
                </div>
              )}
              <EnviarFotos vagas={MAX_FOTOS - fotos.length} />
            </div>
          </>
        )}

        <h2 id="publicacoes">Publicações</h2>
        {cliente?.ramo && (
          <div className="acoes" style={{ marginBottom: 14 }}>
            {!temFuturos ? (
              <form action={gerarSemana}><Botao className="btn">{assinante ? "Criar posts da semana" : "Criar minha semana grátis"}</Botao></form>
            ) : assinante ? (
              <form action={refazerSemana}>
                <Botao className="btn ghost">Refazer a semana</Botao>
                <small className="dica" style={{ marginLeft: 8 }}>Apaga os posts não aprovados e cria outros.</small>
              </form>
            ) : null}
          </div>
        )}

        {pendentes > 0 && (
          <div className="aviso pend" role="status">
            <span>{pendentes === 1 ? "1 post está aguardando a sua aprovação." : `${pendentes} posts estão aguardando a sua aprovação.`}</span>
            <span className="acoes" style={{ margin: 0 }}>
              {filtro !== "pendentes" && <Link className="btn sm" href={link({ f: "pendentes", ver: undefined, periodo: undefined, d: undefined, m: undefined }) + "#publicacoes"}>Ver pendentes</Link>}
              <form action={aprovarTodos}><input type="hidden" name="vista" value={vista} /><Botao className="btn sm ghost">Aprovar todos ({pendentes})</Botao></form>
            </span>
          </div>
        )}
        {semArte > 0 && (
          <div className="aviso" role="status">
            {semArte === 1 ? "1 post ainda está sem arte." : `${semArte} posts ainda estão sem arte.`} Toque em "Criar arte" para ver antes de aprovar (leva uns 30 segundos). Se aprovar sem arte, ela é criada antes de publicar.
          </div>
        )}

        <nav className="filtros" aria-label="Filtrar publicações por situação">
          {(Object.keys(FILTROS) as Filtro[]).map((f) => (
            <Link key={f} href={link({ f, d: undefined }) + "#publicacoes"} className={`filtro${f === filtro ? " ativo" : ""}`} aria-current={f === filtro ? "page" : undefined}>
              {FILTROS[f].rotulo} <b>{contagem[f]}</b>
            </Link>
          ))}
        </nav>
        <div className="filtros2">
          <span className="alternar" role="group" aria-label="Forma de ver">
            <Link href={link({ ver: undefined, m: undefined, d: undefined }) + "#publicacoes"} className={!calendario ? "ativo" : ""}>Lista</Link>
            <Link href={link({ ver: "calendario", m: mes, d: undefined }) + "#publicacoes"} className={calendario ? "ativo" : ""}>Calendário</Link>
          </span>
          {!calendario && (
            <span className="alternar" role="group" aria-label="Período">
              {Object.entries(PERIODOS).map(([k, r]) => (
                <Link key={k} href={link({ periodo: k === "tudo" ? undefined : k }) + "#publicacoes"} className={k === periodo ? "ativo" : ""}>{r}</Link>
              ))}
            </span>
          )}
        </div>

        {calendario && (() => {
          const primeiro = new Date(Date.UTC(anoCal, mesCal - 1, 1)).getUTCDay();
          const total = new Date(Date.UTC(anoCal, mesCal, 0)).getUTCDate();
          const ant = new Date(Date.UTC(anoCal, mesCal - 2, 1)).toISOString().slice(0, 7);
          const prox = new Date(Date.UTC(anoCal, mesCal, 1)).toISOString().slice(0, 7);
          return (
            <div className="card">
              <div className="cal-topo">
                <Link className="btn sm ghost" href={link({ m: ant, d: undefined }) + "#publicacoes"} aria-label="Mês anterior">‹</Link>
                <b>{MESES[mesCal - 1]} de {anoCal}</b>
                <Link className="btn sm ghost" href={link({ m: prox, d: undefined }) + "#publicacoes"} aria-label="Próximo mês">›</Link>
              </div>
              <div className="cal">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((x, i) => <span key={i} className="cal-sem">{x}</span>)}
                {Array.from({ length: primeiro }).map((_, i) => <span key={`v${i}`} />)}
                {Array.from({ length: total }).map((_, i) => {
                  const k = `${mes}-${String(i + 1).padStart(2, "0")}`, ps = porDia.get(k);
                  return (
                    <Link key={k} href={link({ d: k }) + "#publicacoes"} className={`cal-dia${k === diaSel ? " sel" : ""}${k === hoje ? " hoje" : ""}`}
                      aria-label={`Dia ${i + 1}${ps ? `, ${ps.length} ${ps.length === 1 ? "post" : "posts"}` : ""}`}>
                      {i + 1}
                      {ps && <span className="cal-pontos">{ps.slice(0, 3).map((x, j) => <i key={j} style={{ background: corDia[x.sit.chave] }} />)}</span>}
                    </Link>
                  );
                })}
              </div>
              <p className="legenda-cal"><i style={{ background: "#d9a400" }} />aguardando <i style={{ background: "#2563eb" }} />agendado <i style={{ background: "var(--ok)" }} />publicado <i style={{ background: "var(--err)" }} />falhou</p>
            </div>
          );
        })()}

        {calendario && <h3 className="dia-titulo">{diaSel ? `Dia ${diaSel.split("-").reverse().join("/")}` : "Nenhum post neste mês com este filtro"}</h3>}

        {!posts?.length && !calendario ? (
          <div className="card">
            <p style={{ margin: 0 }}>
              {cliente?.ramo ? "Ainda não há posts. Clique no botão acima e a Scrull cria a sua semana." : "Preencha o briefing da marca acima para a Scrull começar a criar seus posts."}
            </p>
          </div>
        ) : !mostrados.length ? (
          <div className="card"><p style={{ margin: 0 }} className="sub">Nenhuma publicação {calendario ? "neste dia" : "com este filtro"}.</p></div>
        ) : (
          mostrados.map(({ p, sit }) => (
            <CartaoPost key={p.id} post={p} sit={sit} perfil={conta?.ig_username ?? undefined} assinante={assinante} temConta={!!conta}
              facebook={!!paginaFb && (cfg?.publicar_facebook ?? true)} vista={vista}
              historico={((hist ?? []) as Historico[]).filter((h) => h.post_id === p.id)}
              artes={{ usadasNoPost: artes.porPost[p.id] ?? 0, porPost: ARTES_POR_POST, noMes: artes.noMes, limiteMes,
                proximaVaga: artes.proximaVaga, demo: !assinante, demoTotal: ARTES_DEMO }} />
          ))
        )}

        <h2>Ajustes</h2>
        <div className="card">
          <Chave campo="postar_sem_aprovacao" valor={!!cfg?.postar_sem_aprovacao} titulo="Postar sem pedir aprovação" descricao="Desligado: nada vai ao ar sem você aprovar." />
          <Chave campo="melhor_horario" valor={cfg?.melhor_horario ?? true} titulo="Escolher o melhor horário" descricao="Usa os horários em que seus seguidores estão online." />
          {paginaFb && (
            <Chave campo="publicar_facebook" valor={cfg?.publicar_facebook ?? true} titulo="Publicar também no Facebook" descricao={`O mesmo post sai na Página ${paginaFb}, no mesmo horário.`} />
          )}
          <Chave campo="pausado" valor={!!cfg?.pausado} titulo="Pausar publicações" descricao="Nenhum post sai enquanto estiver ligado." />
        </div>
        {assinante && cliente?.mp_assinatura_id && (
          <details className="card cancelar">
            <summary>Cancelar assinatura</summary>
            <p className="sub" style={{ marginTop: 10 }}>Ao cancelar, a cobrança mensal para e a Scrull deixa de publicar. Seus posts ficam guardados.</p>
            <form action={cancelar}><Botao className="btn ghost">Confirmar cancelamento</Botao></form>
          </details>
        )}
      </main>
    </>
  );
}
