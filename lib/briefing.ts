// Briefing da marca: o que a IA precisa saber sobre cada empresa para criar posts
// que parecem feitos por quem conhece o negócio. Fica em clientes.briefing (JSON).

export type Briefing = {
  sobre?: string;        // o que a empresa faz, em poucas linhas
  publico?: string;      // para quem vende
  diferencial?: string;  // por que escolher essa empresa
  historia?: string;     // como começou, quem está por trás
  oferta?: string;       // promoção ou chamada atual (opcional)
  cores?: string;        // cores da marca, ex.: "roxo e branco"
  evitar?: string;       // o que o cliente NÃO quer nos posts (vale para legenda, imagem e revisão da arte)
};

export const CAMPOS_BRIEFING: { chave: keyof Briefing; rotulo: string; dica: string; linhas: number }[] = [
  { chave: "sobre", rotulo: "Sobre a empresa", dica: "O que vocês fazem e como funciona, em poucas linhas.", linhas: 3 },
  { chave: "publico", rotulo: "Para quem é", dica: "Ex.: motociclistas da região, mães que trabalham fora, donos de pequenos negócios.", linhas: 2 },
  { chave: "diferencial", rotulo: "Diferencial", dica: "Por que o cliente escolhe vocês e não o concorrente.", linhas: 2 },
  { chave: "historia", rotulo: "História", dica: "Como começou, quem está por trás. A IA usa para posts de bastidores.", linhas: 3 },
  { chave: "oferta", rotulo: "Oferta atual", dica: "Promoção, teste grátis ou chamada do momento. Pode deixar em branco.", linhas: 2 },
  { chave: "cores", rotulo: "Cores da marca", dica: "Ex.: roxo escuro e branco. Usadas nas artes.", linhas: 1 },
  { chave: "evitar", rotulo: "O que você NÃO quer nos posts", dica: "Opcional. Vale para o texto e para a imagem. Ex.: \"pudim com furinho, só liso\", \"nada de piada\", \"não mostrar preço\".", linhas: 2 },
];

export function lerBriefing(valor: unknown): Briefing {
  if (!valor || typeof valor !== "object") return {};
  const b: Briefing = {};
  for (const { chave } of CAMPOS_BRIEFING) {
    const v = (valor as Record<string, unknown>)[chave];
    if (typeof v === "string" && v.trim()) b[chave] = v.trim().slice(0, 1200);
  }
  return b;
}

// Texto do briefing para colocar no prompt da IA
export function briefingParaPrompt(b: Briefing): string {
  const linhas = CAMPOS_BRIEFING
    .filter(({ chave }) => b[chave])
    .map(({ chave, rotulo }) => `${rotulo}: ${b[chave]}`);
  return linhas.length ? linhas.join("\n") : "(sem briefing preenchido)";
}
