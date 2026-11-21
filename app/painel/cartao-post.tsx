// Cartão de um post no painel: arte (com prévia grande), situação real, motivo de falha,
// botões separados (Aprovar, Mudar data, Publicar agora), limite de trocas de arte e histórico.
import { VerPost } from "./ver-post";
import { Botao } from "./botao";
import { PublicarAgora } from "./publicar-agora";
import { aprovarPost, recusarPost, salvarLegenda, mudarHorario } from "./actions";
import { gerarImagemPost, publicarAgora, reescreverLegendaPost, salvarTitulo } from "./gerar";
import { dataHora, type Situacao } from "@/lib/status-post";

export type Historico = { post_id: string; acao: string; detalhe: string | null; quem: string | null; em: string };
export type InfoArtes = { usadasNoPost: number; porPost: number; noMes: number; limiteMes: number; proximaVaga: string | null; demo: boolean; demoTotal: number };

const ACOES: Record<string, string> = {
  criado: "Criado", aprovado: "Aprovado", recusado: "Recusado", arte: "Arte", legenda: "Legenda",
  horario: "Data alterada", titulo: "Título alterado", publicando: "Enviando ao Instagram", publicado: "Publicado", falhou: "Falhou",
};

// Valor do campo de data (AAAA-MM-DDTHH:MM) no horário de Brasília
const paraCampo = (iso: string) =>
  new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 16);

export function CartaoPost(p: {
  post: any; sit: Situacao; perfil?: string; assinante: boolean; temConta: boolean; facebook: boolean;
  artes: InfoArtes; historico: Historico[]; vista: string;
}) {
  const { post, sit, artes } = p;
  const id = post.id as string;
  const editavel = ["aguardando_aprovacao", "aprovado", "recusado", "erro"].includes(post.status);
  const Oculto = () => <><input type="hidden" name="id" value={id} /><input type="hidden" name="vista" value={p.vista} /></>;

  // Trocas de arte: por post (3 artes = 2 trocas) e por mês (últimos 30 dias)
  const restamNoPost = artes.porPost - artes.usadasNoPost;
  const restamNoMes = artes.demo ? artes.demoTotal - artes.noMes : artes.limiteMes - artes.noMes;
  const podeArte = restamNoPost > 0 && restamNoMes > 0;
  const vaga = artes.proximaVaga ? new Date(artes.proximaVaga).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : null;

  const podePublicar = p.assinante && p.temConta && post.imagem_url && ["aguardando_aprovacao", "aprovado", "erro"].includes(post.status);

  return (
    <div className={`card post sit-${sit.chave}`} id={`post-${id}`}>
      <div className="arte">
        {post.imagem_url ? (
          <VerPost imagem={post.imagem_url} titulo={post.titulo_arte ?? ""} legenda={post.legenda} hashtags={post.hashtags ?? []}
            perfil={p.perfil} quando={post.status === "publicado" && post.publicado_em ? `publicado ${dataHora(post.publicado_em)}` : dataHora(post.agendado_para)}>
            {editavel && post.status !== "aprovado" && (
              <form action={aprovarPost}><Oculto /><Botao className="btn">Aprovar e agendar</Botao></form>
            )}
            {editavel && post.status !== "recusado" && (
              <form action={recusarPost}><Oculto /><Botao className="btn ghost">Recusar</Botao></form>
            )}
          </VerPost>
        ) : (
          <div>
            <b>{post.titulo_arte}</b>
            {post.subtitulo && <span>{post.subtitulo}</span>}
            {!!post.topicos?.length && <ul>{post.topicos.map((t: string) => <li key={t}>✓ {t}</li>)}</ul>}
          </div>
        )}
      </div>
      <div>
        <div className="meta">
          <span>{post.status === "publicado" && post.publicado_em ? `Publicado ${dataHora(post.publicado_em)}` : dataHora(post.agendado_para)}</span>
          <span className={`badge ${sit.cor}`}>{sit.chave === "publicando" && <span className="giro" aria-hidden="true" />}{sit.rotulo}</span>
        </div>
        {sit.detalhe && <p className="situacao">{sit.detalhe}</p>}
        {post.status === "erro" && post.erro_msg && (
          <p className="erro"><b>Motivo:</b> {post.erro_msg}</p>
        )}
        {post.status === "publicado" && post.ig_permalink && (
          <p className="situacao"><a href={post.ig_permalink} target="_blank" rel="noopener noreferrer">Ver no Instagram ↗</a></p>
        )}
        {post.fb_post_id && <p className="sub" style={{ margin: "0 0 6px" }}>Saiu também no Facebook.</p>}
        {post.fb_erro_msg && <p className="erro">{post.fb_erro_msg}</p>}
        {post.tema && <p className="tema">{post.tema}</p>}
        <p className="legenda">{post.legenda}</p>
        {!!post.hashtags?.length && <p className="tags">{post.hashtags.join(" ")}</p>}

        {editavel && (
          <>
            <div className="acoes">
              {post.status !== "aprovado" && (
                <form action={aprovarPost}><Oculto /><Botao className="btn sm">{post.status === "erro" ? "Aprovar de novo" : "Aprovar e agendar"}</Botao></form>
              )}
              {podePublicar && (
                <PublicarAgora id={id} vista={p.vista} acao={publicarAgora} facebook={p.facebook}
                  rotulo={post.status === "erro" ? "Tentar de novo agora" : "Publicar agora"} />
              )}
              {post.status !== "recusado" && (
                <form action={recusarPost}><Oculto /><Botao className="btn sm ghost">Recusar</Botao></form>
              )}
            </div>
            {post.status === "aprovado" && <small className="dica">Aprovado: sai sozinho na data marcada. Para tirar da fila, toque em Recusar.</small>}

            <div className="acoes" style={{ marginTop: 8 }}>
              {podeArte ? (
                <form action={gerarImagemPost}><Oculto />
                  <Botao className={`btn sm ${post.imagem_url ? "ghost" : ""}`}>{post.imagem_url ? "Trocar a arte" : "Criar arte"}</Botao>
                </form>
              ) : artes.demo ? (
                <span className="assine">Assine para ter a criação de artes e a postagem automatizada, sem esforço e sem gastar seu tempo.</span>
              ) : null}
              <form action={reescreverLegendaPost}><Oculto /><Botao className="btn sm ghost">Reescrever legenda</Botao></form>
            </div>
            <small className="dica limite">
              {artes.demo
                ? `Demonstração: ${Math.max(0, restamNoMes)} de ${artes.demoTotal} artes grátis restantes.`
                : restamNoPost <= 0
                  ? `Este post já usou as ${artes.porPost} artes (${artes.porPost - 1} trocas). Esse limite não renova: aprove uma das artes ou edite a legenda.`
                  : `Trocas neste post: ${restamNoPost === artes.porPost ? `${artes.porPost - 1} disponíveis` : `${Math.min(restamNoPost, artes.porPost - 1)} de ${artes.porPost - 1} restantes`}. ` +
                    `Artes no mês: ${artes.noMes} de ${artes.limiteMes}` +
                    (restamNoMes <= 0 ? `; limite atingido${vaga ? `, a próxima vaga abre em ${vaga}` : ""}.` : ` (o mês conta os últimos 30 dias; cada arte libera a vaga 30 dias depois de criada).`)}
            </small>

            <details className="mini">
              <summary>Editar título da arte</summary>
              <form action={salvarTitulo} style={{ marginTop: 8 }}>
                <Oculto />
                <label htmlFor={`tit-${id}`}>Título <small className="dica">curto e direto, até 60 letras</small></label>
                <input id={`tit-${id}`} name="titulo" className="campo" defaultValue={post.titulo_arte ?? ""} maxLength={60} required />
                <label htmlFor={`sub-${id}`}>Subtítulo <small className="dica">opcional, até 90 letras</small></label>
                <input id={`sub-${id}`} name="subtitulo" className="campo" defaultValue={post.subtitulo ?? ""} maxLength={90} />
                <Botao className="btn sm">{post.imagem_url && podeArte ? "Salvar e refazer a arte" : "Salvar título"}</Botao>
              </form>
              <small className="dica">{post.imagem_url
                ? (podeArte ? "A arte é refeita com o texto novo (usa uma troca)." : "Sem trocas neste post: o texto fica salvo para a próxima arte.")
                : "O texto entra na arte quando ela for criada."}</small>
            </details>
            <details className="mini">
              <summary>Mudar data e horário</summary>
              <form action={mudarHorario} className="acoes" style={{ marginTop: 8 }}>
                <Oculto />
                <input type="datetime-local" name="quando" className="campo" style={{ margin: 0, maxWidth: 240 }}
                  defaultValue={paraCampo(post.agendado_para)} required aria-label="Nova data e horário (Brasília)" />
                <Botao className="btn sm">Salvar data</Botao>
              </form>
              <small className="dica">Horário de Brasília. {post.status === "aprovado" ? "Continua aprovado na nova data." : "Depois, aprove para agendar."}</small>
            </details>
            <details className="mini">
              <summary>Editar legenda</summary>
              <form action={salvarLegenda}>
                <Oculto />
                <textarea className="campo" name="legenda" rows={5} defaultValue={post.legenda} aria-label="Legenda do post" />
                <Botao className="btn sm">Salvar legenda</Botao>
              </form>
            </details>
          </>
        )}

        {!!p.historico.length && (
          <details className="mini">
            <summary>Histórico ({p.historico.length})</summary>
            <ul className="historico">
              {p.historico.map((h, i) => (
                <li key={i}>
                  <time>{new Date(h.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</time>
                  <b>{ACOES[h.acao] ?? h.acao}</b>
                  {h.detalhe && !h.detalhe.startsWith("http") && <span> · {h.detalhe}</span>}
                  {h.quem && h.quem !== "cliente" && <em> · {h.quem === "automático" ? "automático" : "equipe Scrull"}</em>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
