import { redirect } from "next/navigation";
import { gerarSemana, salvarPerfil } from "./gerar";
import { supabaseDoUsuario } from "@/lib/supabase";
import { aprovarPost, recusarPost, aprovarTodos, salvarLegenda, alternarConfig, sair } from "./actions";

const AVISOS: Record<string, [string, boolean]> = {
  ok: ["Instagram conectado! Já podemos criar seus posts.", true],
  "ger-ok": ["Posts criados! Revise e aprove cada um.", true],
  "ger-cedo": ["Seus posts da semana já foram criados. Revise e aprove os da lista.", false],
  "ger-erro": ["Não foi possível criar os posts agora. Tente de novo em instantes.", false],
  negado: ["Você cancelou a conexão. Quando quiser, é só tentar de novo.", false],
  erro: ["Não foi possível conectar agora. Tente de novo em instantes.", false],
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
    supabase.from("contas_instagram").select("id, ig_username").eq("ativa", true).limit(1),
    supabase.from("posts").select("*").gte("agendado_para", new Date().toISOString())
      .order("agendado_para").limit(14),
  ]);

  const conta = contas?.[0];
  const aviso = ig ? AVISOS[ig] : undefined;
  const diasTeste = cliente?.assinatura === "teste"
    ? Math.max(0, Math.ceil((new Date(cliente.teste_ate).getTime() - Date.now()) / 86400000))
    : null;
  const quando = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      weekday: "short", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
    });
  const pendentes = posts?.filter((p) => p.status === "aguardando_aprovacao").length ?? 0;

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

        <h2>Posts da semana</h2>
        {conta && !cliente?.ramo && (
          <form action={salvarPerfil} className="card">
            <label htmlFor="ramo">O que a sua empresa vende?</label>
            <input id="ramo" name="ramo" className="campo" placeholder="Ex.: pizzaria, loja de roupas" required />
            <label htmlFor="tom">Como você quer falar com seus clientes?</label>
            <select id="tom" name="tom" className="campo">
              <option>Próximo e acolhedor</option><option>Divertido e descontraído</option>
              <option>Elegante e sofisticado</option><option>Direto e profissional</option>
            </select>
            <button className="btn">Salvar</button>
          </form>
        )}
        {conta && cliente?.ramo && (
          <form action={gerarSemana} style={{ marginBottom: 14 }}>
            <button className="btn">Criar posts da semana</button>
          </form>
        )}
        {!posts?.length ? (
          <div className="card">
            <p style={{ margin: 0 }}>
              {conta ? "Ainda não há posts agendados. Em breve a Scrull vai criar a sua semana aqui." : "Conecte o Instagram para a Scrull começar a criar seus posts."}
            </p>
          </div>
        ) : (
          <>
            {pendentes > 0 && (
              <form action={aprovarTodos} style={{ marginBottom: 14 }}>
                <button className="btn">Aprovar todos ({pendentes})</button>
              </form>
            )}
            {posts.map((p) => {
              const [rotulo, cor] = STATUS[p.status] ?? [p.status, ""];
              const editavel = p.status === "aguardando_aprovacao" || p.status === "aprovado" || p.status === "recusado";
              return (
                <div className="card post" key={p.id}>
                  <div className="arte">{p.imagem_url ? <img src={p.imagem_url} alt="" /> : p.titulo_arte}</div>
                  <div>
                    <div className="meta"><span>{quando(p.agendado_para)}</span><span className={`badge ${cor}`}>{rotulo}</span></div>
                    <p className="legenda">{p.legenda}</p>
                    {!!p.hashtags?.length && <p className="tags">{p.hashtags.join(" ")}</p>}
                    {p.erro_msg && <p className="erro">{p.erro_msg}</p>}
                    {editavel && (
                      <div className="acoes">
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
                            <textarea className="campo" name="legenda" rows={4} defaultValue={p.legenda} aria-label="Legenda do post" />
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
