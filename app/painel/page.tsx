import { redirect } from "next/navigation";
import { gerarSemana, refazerSemana, salvarPerfil, gerarImagemPost, publicarAgora, assinar, cancelar, reescreverLegendaPost } from "./gerar";
import { supabaseDoUsuario } from "@/lib/supabase";
import { CAMPOS_BRIEFING, lerBriefing } from "@/lib/briefing";
import { ARTES_POR_POST, ARTES_DEMO, contarArtes } from "@/lib/imagem";
import { VerPost } from "./ver-post";
import { Botao } from "./botao";
import { EnviarFotos } from "./enviar-fotos";
import { apagarFoto } from "./fotos";
import { listarFotos, MAX_FOTOS } from "@/lib/fotos";
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
  "pub-ok": ["Post publicado no Instagram!", true],
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

const STATUS: Record<string, [string, string]> = {
  aguardando_aprovacao: ["Aguardando você", ""],
  aprovado: ["Aprovado: sai na hora marcada", "ok"],
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

  const [{ data: cliente }, { data: cfg }, { data: contas }, { data: posts }, { data: planos }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", user.id).single(),
    supabase.from("configuracoes").select("*").eq("cliente_id", user.id).single(),
    supabase.from("contas_instagram").select("id, ig_username")
      .eq("cliente_id", user.id).eq("ativa", true).limit(1),
    supabase.from("posts").select("*").eq("cliente_id", user.id)
      .gte("agendado_para", new Date().toISOString())
      .order("agendado_para").limit(14),
    supabase.from("planos").select("id, nome, preco_centavos, preco_cheio_centavos, posts_por_semana").eq("ativo", true).order("preco_centavos"),
  ]);
  const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const ehDono = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((e) => e.trim()).includes((user.email ?? "").toLowerCase());
  const fotos = await listarFotos(user.id).catch(() => []);
  const conta = contas?.[0];
  const semArtes = { porPost: {} as Record<string, number>, noMes: 0 };
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
  const semArte = posts?.filter((p) => !p.imagem_url && p.status !== "recusado").length ?? 0;

  return (
    <>
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

        <h2>Posts da semana</h2>
        {cliente?.ramo && (
          <div className="acoes" style={{ marginBottom: 14 }}>
            {!posts?.length ? (
              <form action={gerarSemana}><Botao className="btn">{assinante ? "Criar posts da semana" : "Criar minha semana grátis"}</Botao></form>
            ) : assinante ? (
              <form action={refazerSemana}>
                <Botao className="btn ghost">Refazer a semana</Botao>
                <small className="dica" style={{ marginLeft: 8 }}>Apaga os posts não aprovados e cria outros.</small>
              </form>
            ) : null}
          </div>
        )}
        {!posts?.length ? (
          <div className="card">
            <p style={{ margin: 0 }}>
              {cliente?.ramo ? "Ainda não há posts. Clique no botão acima e a Scrull cria a sua semana." : "Preencha o briefing da marca acima para a Scrull começar a criar seus posts."}
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
                <Botao className="btn">Aprovar todos ({pendentes})</Botao>
              </form>
            )}
            {posts.map((p) => {
              const [rotulo, cor] = STATUS[p.status] ?? [p.status, ""];
              const editavel = ["aguardando_aprovacao", "aprovado", "recusado", "erro"].includes(p.status);
              return (
                <div className="card post" key={p.id} id={`post-${p.id}`}>
                  <div className="arte">
                    {p.imagem_url ? (
                      <VerPost imagem={p.imagem_url} titulo={p.titulo_arte ?? ""} legenda={p.legenda} hashtags={p.hashtags ?? []}
                        perfil={conta?.ig_username ?? undefined} quando={quando(p.agendado_para)}>
                        {editavel && p.status !== "aprovado" && (
                          <form action={aprovarPost}><input type="hidden" name="id" value={p.id} /><Botao className="btn">Aprovar este post</Botao></form>
                        )}
                        {editavel && p.status !== "recusado" && (
                          <form action={recusarPost}><input type="hidden" name="id" value={p.id} /><Botao className="btn ghost">Recusar</Botao></form>
                        )}
                      </VerPost>
                    ) : (
                      <div>
                        <b>{p.titulo_arte}</b>
                        {p.subtitulo && <span>{p.subtitulo}</span>}
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
                        {(assinante ? (artes.porPost[p.id] ?? 0) < ARTES_POR_POST : artes.noMes < ARTES_DEMO) ? (
                          <form action={gerarImagemPost}>
                            <input type="hidden" name="id" value={p.id} />
                            <Botao className={`btn sm ${p.imagem_url ? "ghost" : ""}`}>
                              {p.imagem_url ? `Trocar a arte (${assinante ? ARTES_POR_POST - (artes.porPost[p.id] ?? 0) : ARTES_DEMO - artes.noMes} ${(assinante ? ARTES_POR_POST - (artes.porPost[p.id] ?? 0) : ARTES_DEMO - artes.noMes) === 1 ? "troca restante" : "trocas restantes"})` : "Criar arte"}
                            </Botao>
                          </form>
                        ) : (
                          assinante
                            ? <span className="badge cinza">Limite de artes deste post</span>
                            : <span className="assine">Assine para ter a criação de artes e a postagem automatizada, sem esforço e sem gastar seu tempo.</span>
                        )}
                        {assinante && conta && p.imagem_url && (
                          <form action={publicarAgora}><input type="hidden" name="id" value={p.id} /><Botao className="btn sm ig-agora">Publicar agora</Botao></form>
                        )}
                        {p.status !== "aprovado" && (
                          <form action={aprovarPost}><input type="hidden" name="id" value={p.id} /><Botao className="btn sm">Aprovar</Botao></form>
                        )}
                        {p.status !== "recusado" && (
                          <form action={recusarPost}><input type="hidden" name="id" value={p.id} /><Botao className="btn sm ghost">Recusar</Botao></form>
                        )}
                        <form action={reescreverLegendaPost}><input type="hidden" name="id" value={p.id} /><Botao className="btn sm ghost">Reescrever legenda</Botao></form>
                        <details>
                          <summary>Editar legenda</summary>
                          <form action={salvarLegenda}>
                            <input type="hidden" name="id" value={p.id} />
                            <textarea className="campo" name="legenda" rows={5} defaultValue={p.legenda} aria-label="Legenda do post" />
                            <Botao className="btn sm">Salvar legenda</Botao>
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
