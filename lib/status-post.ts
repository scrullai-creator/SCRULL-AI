// Situação real de cada post, do jeito que o cliente precisa ver.
// "Publicado" só aparece quando o Instagram confirmou (status gravado depois da resposta da plataforma);
// um post aprovado com data futura é "Agendado", nunca "Publicado".

export type PostStatus = { status: string; agendado_para: string; publicado_em?: string | null; imagem_url?: string | null };
export type Contexto = { assinante: boolean; pausado: boolean; temConta: boolean; agora?: number };

export type Situacao = {
  chave: "pendente" | "agendado" | "na_fila" | "aprovado_parado" | "publicando" | "publicado" | "falhou" | "recusado" | "rascunho";
  rotulo: string;
  cor: "" | "ok" | "cinza" | "azul" | "erro" | "andamento";
  detalhe?: string;
};

const TZ = "America/Sao_Paulo";
export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ });

export function situacao(p: PostStatus, c: Contexto): Situacao {
  const agora = c.agora ?? Date.now();
  const hora = new Date(p.agendado_para).getTime();
  switch (p.status) {
    case "aguardando_aprovacao":
      return { chave: "pendente", rotulo: "Aguardando aprovação", cor: "", detalhe: "Nada vai ao ar sem você aprovar." };
    case "aprovado": {
      // Aprovado, mas algo impede de sair: avisa o motivo em vez de fingir que está agendado
      const motivo = !c.assinante ? "assine para publicar" : !c.temConta ? "conecte o Instagram" : c.pausado ? "as publicações estão pausadas nos Ajustes" : "";
      if (motivo) return { chave: "aprovado_parado", rotulo: "Aprovado, mas não vai sair", cor: "", detalhe: `Para sair na hora marcada, ${motivo}.` };
      if (hora > agora) return { chave: "agendado", rotulo: "Agendado", cor: "azul", detalhe: `Sai ${dataHora(p.agendado_para)}${p.imagem_url ? "" : " (a arte é criada antes)"}.` };
      if (agora - hora <= 24 * 3600 * 1000) return { chave: "na_fila", rotulo: "Na fila de publicação", cor: "andamento", detalhe: "Sai nos próximos minutos." };
      return { chave: "aprovado_parado", rotulo: "Horário perdido", cor: "", detalhe: "Passou mais de um dia da hora marcada. Mude a data ou publique agora." };
    }
    case "publicando":
      return { chave: "publicando", rotulo: "Publicando…", cor: "andamento", detalhe: "Enviando para o Instagram. Leva menos de um minuto." };
    case "publicado":
      return { chave: "publicado", rotulo: "Publicado", cor: "ok", detalhe: p.publicado_em ? `Saiu no Instagram ${dataHora(p.publicado_em)}.` : "Confirmado pelo Instagram." };
    case "erro":
      return { chave: "falhou", rotulo: "Falhou", cor: "erro" };
    case "recusado":
      return { chave: "recusado", rotulo: "Recusado", cor: "cinza" };
    default:
      return { chave: "rascunho", rotulo: "Rascunho", cor: "cinza" };
  }
}

// Filtros do painel: o que cada aba mostra
export const FILTROS = {
  ativos: { rotulo: "Em andamento", chaves: ["pendente", "falhou", "aprovado_parado", "agendado", "na_fila", "publicando"] },
  pendentes: { rotulo: "Aguardando você", chaves: ["pendente", "falhou", "aprovado_parado"] },
  agendados: { rotulo: "Agendados", chaves: ["agendado", "na_fila", "publicando"] },
  publicados: { rotulo: "Publicados", chaves: ["publicado"] },
  falhas: { rotulo: "Falharam", chaves: ["falhou"] },
  recusados: { rotulo: "Recusados", chaves: ["recusado"] },
  todos: { rotulo: "Todos", chaves: [] as string[] },
} as const;
export type Filtro = keyof typeof FILTROS;

export function passaNoFiltro(s: Situacao, f: Filtro) {
  const chaves = FILTROS[f].chaves as readonly string[];
  return !chaves.length || chaves.includes(s.chave);
}
