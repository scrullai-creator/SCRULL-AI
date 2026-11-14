import { redirect } from "next/navigation";
import { gerarSemana, refazerSemana, salvarPerfil, gerarImagemPost } from "./gerar";
import { supabaseDoUsuario } from "@/lib/supabase";
import { CAMPOS_BRIEFING, lerBriefing } from "@/lib/briefing";
import { aprovarPost, recusarPost, aprovarTodos, salvarLegenda, alternarConfig, sair } from "./actions";

// Gerar a arte pode levar até ~40 s
export const maxDuration = 60;

const AVISOS: Record<string, [string, boolean]> = {
  ok: ["Instagram conectado! Já podemos criar seus posts.", true],
  "ger-ok": ["Posts criados! Revise, crie as artes e aprove cada um.", true],
  "ger-cedo": ["Seus posts da semana já foram criados. Para criar outros, use \"Refazer a semana\".", false],
  "ger-erro": ["Não foi possível criar os posts agora. Tente de novo em instantes.", false],
  "img-ok": ["Arte criada! Se não gostar, é só gerar outra.", true],
  "img-erro": ["Não foi possível criar a arte agora. Tente de novo em instantes.", false],
  "perfil-ok": ["Briefing salvo! Agora a Scrull conhece a sua marca.", true],
  "perfil-erro": ["Não foi possível salvar o briefing. Tente de novo.", false],
  negado: ["Você cancelou a conexão. Quando quiser, é só tentar de novo.", false],
  erro: ["Não foi possível conectar agora. Tente de novo em instantes.", false],
  "sem-conta": ["Nenhuma conta do Instagram foi compartilhada. Conecte de novo e selecione a conta da sua empresa.", false],
  "conta-pessoal": ["Essa conta é pessoal. Mude para Comercial ou Criador nas configurações do Instagram e conecte de novo.", false],
};

const STATUS: Record<string, [string, string]> = {
  aguardando_aprovacao: ["Aguardando você", ""],
  aprovado: ["Aprovado", "ok"],
  recusado: ["Recusado", "cinza"],
  publicado: ["Publicado", "ok"],
  erro: ["Erro ao publicar", ""],
  rascunho: ["Rascunho", "cinza"],
};

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

export default async function Painel({ searchParams }: { searchParams: Promise<{ ig?: string }> }) {
  const { ig } = await searchParams;
  const supabase = await supabaseDoUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: cliente }, { data: cfg }, { data: contas }, { data: posts }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", user.id).single(),
    supabase.from("configuracoes").select("*").eq("cliente_id", user.id).single(),
    supabase.from("contas_instagram").select("id, ig_username")
      .eq("cliente_id", user.id).eq("ativa", true).limit(1),
    supabase.from("posts").select("*").eq("cliente_id", user.id)
      .gte("agendado_para", new Date().toISOString())
      .order("agendado_para").limit(14),
  ]);

  const conta = contas?.[0];
  const aviso = ig ? AVISOS[ig] : undefined;
  const briefing = lerBriefing(cliente?.briefing);
  const briefingPreenchido = Object.keys(briefing).length > 0;
  const diasTeste = cliente?.assinatura === "teste"
    ? Math.max(0, Math.ceil((new Date(cliente.teste_ate).getTime() - Date.now()) / 86400000))
    : null;
  const quando = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      weekday: "short", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
    });
  const pendentes = posts?.filter((p) => p.status === "aguardando_aprovacao").length ?? 0;
  const semArte = posts?.filter((p) => !p.imagem_url && p.status !== "recusado").length ?? 0;

  return (
    <>
      <header className="topo">
        <div className="logo">SCRULL<i>AI</i></div>
        <form action={sair}><button className="btn sm ghost" style={{ color: "#fff", borderColor: "#ffffff55" }}>Sair</button></form>
      </header>
      <main>
        <h1>Olá, {cliente?.nome_empresa ?? "bem-vinda"}!</h1>
        <p className="sub">
          {diasTeste !== null ? `Seu teste grátis termina em ${diasTeste} ${diasTeste === 1 ? "dia" : "dias"}.` : "Sua assinatura está ativa."}
        </p>

        {aviso && <div className={`aviso ${aviso[1] ? "ok" : ""}`} role="status">{aviso[0]}</div>}

        <div className="card hero">
          {conta ? (
            <>
              <span className="badge ok">Conectado</span>
              <p style={{ margin: "12px 0 0" }}>Perfil @{conta.ig_username} pronto para receber os posts.</p>
            </>
          ) : (
            <>
              <h2 style={{ margin: "0 0 6px" }}>Conecte seu Instagram</h2>
              <p>Um clique, sem digitar a senha. A conta precisa ser Comercial ou Criador.</p>
              <a className="btn ig" href="/api/instagram/connect">Conectar com Instagram</a>
            </>
          )}
        </div>

        {conta && (
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
                  placeholder="Ex.: pizzaria, loja de roupas" required maxLength={120} />
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
                <button className="btn">Salvar briefing</button>
              </form>
            </details>
          </>
        )}

        <h2>Posts da semana</h2>
        {conta && cliente?.ramo && (
          <div className="acoes" style={{ marginBottom: 14 }}>
            {!posts?.length ? (
              <form action={gerarSemana}><button className="btn">Criar posts da semana</button></form>
            ) : (
              <form action={refazerSemana}>
                <button className="btn ghost">Refazer a semana</button>
                <small className="dica" style={{ marginLeft: 8 }}>Apaga os posts não aprovados e cria outros.</small>
              </form>
            )}
          </div>
        )}
        {!posts?.length ? (
          <div className="card">
            <p style={{ margin: 0 }}>
              {conta ? "Ainda não há posts agendados. Preencha o briefing e clique em \"Criar posts da semana\"." : "Conecte o Instagram para a Scrull começar a criar seus posts."}
            </p>
          </div>
        ) : (
          <>
            {semArte > 0 && (
              <div className="aviso" role="status">
                {semArte === 1 ? "1 post ainda está sem arte." : `${semArte} posts ainda estão sem arte.`} Clique em "Criar arte" em cada um (leva uns 30 segundos).
              </div>
            )}
            {pendentes > 0 && (
              <form action={aprovarTodos} style={{ marginBottom: 14 }}>
                <button className="btn">Aprovar todos ({pendentes})</button>
              </form>
            )}
            {posts.map((p) => {
              const [rotulo, cor] = STATUS[p.status] ?? [p.status, ""];
              const editavel = p.status === "aguardando_aprovacao" || p.status === "aprovado" || p.status === "recusado";
              return (
                <div className="card post" key={p.id} id={`post-${p.id}`}>
                  <div className="arte">
                    {p.imagem_url ? <img src={p.imagem_url} alt={p.titulo_arte ?? ""} /> : (
                      <div>
                        <b>{p.titulo_arte}</b>
                        {!!p.topicos?.length && <ul>{p.topicos.map((t: string) => <li key={t}>✓ {t}</li>)}</ul>}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="meta"><span>{quando(p.agendado_para)}</span><span className={`badge ${cor}`}>{rotulo}</span></div>
                    {p.tema && <p className="tema">{p.tema}</p>}
                    <p className="legenda">{p.legenda}</p>
                    {!!p.hashtags?.length && <p className="tags">{p.hashtags.join(" ")}</p>}
                    {p.erro_msg && <p className="erro">{p.erro_msg}</p>}
                    {editavel && (
                      <div className="acoes">
                        <form action={gerarImagemPost}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className={`btn sm ${p.imagem_url ? "ghost" : ""}`}>{p.imagem_url ? "Gerar outra arte" : "Criar arte"}</button>
                        </form>
                        {p.status !== "aprovado" && (
                          <form action={aprovarPost}><input type="hidden" name="id" value={p.id} /><button className="btn sm">Aprovar</button></form>
                        )}
                        {p.status !== "recusado" && (
                          <form action={recusarPost}><input type="hidden" name="id" value={p.id} /><button className="btn sm ghost">Recusar</button></form>
                        )}
                        <details>
                          <summary>Editar legenda</summary>
                          <form action={salvarLegenda}>
                            <input type="hidden" name="id" value={p.id} />
                            <textarea className="campo" name="legenda" rows={5} defaultValue={p.legenda} aria-label="Legenda do post" />
                            <button className="btn sm">Salvar legenda</button>
                          </form>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        <h2>Ajustes</h2>
        <div className="card">
          <Chave campo="postar_sem_aprovacao" valor={!!cfg?.postar_sem_aprovacao} titulo="Postar sem pedir aprovação" descricao="Desligado: nada vai ao ar sem você aprovar." />
          <Chave campo="melhor_horario" valor={cfg?.melhor_horario ?? true} titulo="Escolher o melhor horário" descricao="Usa os horários em que seus seguidores estão online." />
          <Chave campo="pausado" valor={!!cfg?.pausado} titulo="Pausar publicações" descricao="Nenhum post sai enquanto estiver ligado." />
        </div>
      </main>
    </>
  );
}
