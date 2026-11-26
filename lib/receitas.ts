// Perfis de receitas (ex.: @receitas_doschef): cada post é uma receita completa e real,
// com dois modelos de arte que se alternam no feed:
//  - "potes":   prato pronto + ingredientes em potinhos com etiqueta de quantidade (arte completa feita pela IA);
//  - "receita": foto do prato em cima e um cartão de receita embaixo (fundo de papel, colunas "Massa" / "Recheio"),
//               com o texto escrito pelo próprio app (acentos e medidas sempre certos).
// O modo de preparo completo vai sempre na legenda.

export const LAYOUTS_RECEITA = ["potes", "receita"] as const;
export type LayoutReceita = (typeof LAYOUTS_RECEITA)[number];

// Até quantos ingredientes cabem bem no modelo dos potinhos
export const MAX_POTES = 7;

export function ehPerfilDeReceitas(empresa?: string | null, ramo?: string | null): boolean {
  return /receita/i.test(`${empresa ?? ""} ${ramo ?? ""}`);
}

// Os ingredientes ficam na coluna "topicos" do post, um por item, no formato "Grupo|item"
// (ou só "item" quando a receita não tem partes). Ex.: "Massa|3 ovos", "Recheio|200 g de requeijão".
export function separarIngrediente(t: string): { grupo: string; item: string } {
  const i = t.indexOf("|");
  return i < 0 ? { grupo: "", item: t.trim() } : { grupo: t.slice(0, i).trim(), item: t.slice(i + 1).trim() };
}

export function agruparIngredientes(topicos: string[]): { grupo: string; itens: string[] }[] {
  const grupos: { grupo: string; itens: string[] }[] = [];
  for (const t of topicos) {
    const { grupo, item } = separarIngrediente(t);
    if (!item) continue;
    let g = grupos.find((x) => x.grupo === grupo);
    if (!g) grupos.push((g = { grupo, itens: [] }));
    g.itens.push(item);
  }
  return grupos;
}

// Instruções para o Claude quando o perfil é de receitas (substituem a variedade de assuntos dos outros negócios)
export const INSTRUCOES_RECEITAS =
  `ESTE É UM PERFIL DE RECEITAS. TODO post é UMA RECEITA COMPLETA E REAL, que funciona de verdade em casa. ` +
  `Nunca faça post só de dica, curiosidade, frase motivacional, bastidores ou pergunta: sempre uma receita.\n` +
  `- Varie de verdade entre os posts: bolos, doces de colher, tortas e salgados de forno, pratos do dia a dia (almoço e jantar), ` +
  `lanches, receitas de liquidificador, receitas de festa, receitas econômicas. Nunca repita receita do histórico.\n` +
  `- Receitas brasileiras caseiras, com ingredientes de mercado comum e medidas caseiras (xícara, colher de sopa, g, ml, unidade). ` +
  `Medidas coerentes e testáveis: nada de quantidade absurda, nada de ingrediente faltando no modo de preparo.\n` +
  `- "layout": "potes" ou "receita", ALTERNANDO post a post (nunca dois iguais seguidos; o primeiro post novo não repete o layout do mais recente):\n` +
  `  "potes" = arte com o prato pronto e cada ingrediente num potinho com a quantidade escrita ao lado. Só para receitas com ATÉ ${MAX_POTES} ingredientes, sem partes;\n` +
  `  "receita" = foto do prato em cima e cartão de receita embaixo com a lista de ingredientes (pode ter partes, ex.: "Massa" e "Recheio"; até 12 ingredientes).\n` +
  `- "titulo": o NOME da receita, curto e chamativo (ex.: "Bolo de Laranja", "Torta de Frango de Batata"), até 6 palavras.\n` +
  `- "subtitulo": até 6 palavras que dão vontade (ex.: "Fofinho e feito no liquidificador").\n` +
  `- "ingredientes": lista de partes [{"parte": "Massa", "itens": ["3 ovos", "1 xícara de leite"]}]. Sem partes, use uma só com "parte": "". ` +
  `Cada item até 40 caracteres, com a quantidade na frente ("2 xícaras de farinha de trigo", "Sal a gosto").\n` +
  `- "legenda" (até 1800 caracteres, sem hashtags dentro), nesta ordem: 1 ou 2 linhas de abertura humanas e com vontade de comer ` +
  `(o cheiro na cozinha, a textura, a ocasião), depois "Ingredientes:" com todos os itens (um por linha, com "- ", separando as partes), ` +
  `depois "Modo de preparo:" com passos numerados, curtos e completos (temperatura e tempo de forno, ponto certo), ` +
  `rendimento e, se fizer sentido, uma dica de ouro. Feche convidando a salvar a receita ou marcar alguém (varie a chamada).\n` +
  `- "hashtags": de 4 a 6, sobre a receita e receitas caseiras.\n` +
  `- "prompt_imagem" em INGLÊS: para "potes", o prato pronto apetitoso (já com um pedaço cortado quando for bolo ou torta, mostrando o miolo) ` +
  `num cenário de cozinha caseira clara; para "receita", uma foto de cima ou de 45 graus do prato pronto, farto, servido e convidativo. ` +
  `Sem texto na foto. A comida precisa parecer de verdade e dar água na boca.\n`;
