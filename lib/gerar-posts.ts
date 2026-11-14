// O "cérebro" do Scrull AI: lê o briefing da marca e o histórico de posts,
// decide o tema de cada post e escreve título, tópicos, legenda, hashtags
// e a descrição da imagem (que outro serviço transforma em arte).
import { type Briefing, briefingParaPrompt } from "./briefing";

const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";

export type PostGerado = {
  tema: string;
  titulo: string;
  topicos: string[];
  legenda: string;
  hashtags: string[];
  prompt_imagem: string;
};

export type DadosParaGerar = {
  empresa: string;
  ramo: string;
  tom: string;
  quantidade: number;
  briefing: Briefing;
  temLogo: boolean;
  // Posts recentes (título e tema), para não repetir assunto
  historico: { titulo: string; tema?: string | null }[];
};

// A IA às vezes escreve algo antes ou depois do JSON, ou é cortada no meio.
// Fica só com o array e, se ele vier cortado, aproveita os posts completos.
export function extrairLista(texto: string): unknown[] | null {
  const inicio = texto.indexOf("[");
  if (inicio < 0) return null;
  const tentar = (t: string) => {
    try {
      const v = JSON.parse(t);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  const fim = texto.lastIndexOf("]");
  const inteira = fim > inicio ? tentar(texto.slice(inicio, fim + 1)) : null;
  if (inteira) return inteira;
  // Resposta cortada: recua até o último post que fechou certinho
  let corte = texto.lastIndexOf("}");
  while (corte > inicio) {
    const parcial = tentar(texto.slice(inicio, corte + 1) + "]");
    if (parcial) return parcial;
    corte = texto.lastIndexOf("}", corte - 1);
  }
  return null;
}

export function montarPrompt(a: DadosParaGerar): { sistema: string; usuario: string } {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo",
  });
  const historico = a.historico.length
    ? a.historico.map((p) => `- ${p.titulo}${p.tema ? ` (${p.tema})` : ""}`).join("\n")
    : "(nenhum post ainda: esta é a primeira semana da conta, então apresente a empresa)";
  const cores = a.briefing.cores || "as cores da marca, se conhecidas; senão, tons escuros elegantes";
  const logo = a.temLogo
    ? "A logo da marca será anexada à geração da imagem: reserve o canto inferior direito para ela e NÃO descreva nem invente uma logo."
    : `Não há logo: escreva o nome "${a.empresa}" em letras pequenas no canto inferior direito.`;

  const sistema =
    `Você é a social media sênior de uma agência brasileira que cuida do Instagram de pequenos negócios. ` +
    `Você conhece a empresa a fundo pelo briefing e planeja o feed como uma estratégia, não como posts soltos. ` +
    `Escreve em português do Brasil, com naturalidade, sem clichês de IA. ` +
    `Nunca inventa preços, endereços, telefones, números de clientes, prêmios ou depoimentos. ` +
    `Só fala de oferta se o briefing tiver uma. Responde SOMENTE com JSON válido.`;

  const usuario =
    `EMPRESA: ${a.empresa}\nRAMO: ${a.ramo}\nTOM DE VOZ: ${a.tom}\nHOJE: ${hoje}\n\n` +
    `BRIEFING DA MARCA:\n${briefingParaPrompt(a.briefing)}\n\n` +
    `POSTS RECENTES (não repita estes assuntos):\n${historico}\n\n` +
    `TAREFA: crie ${a.quantidade} posts de feed para a próxima semana, todos com temas diferentes entre si e ` +
    `diferentes dos recentes. Varie os formatos ao longo da semana: apresentação/produto, dica útil, bastidores, ` +
    `história da marca, pergunta ao público, quebra de objeção, prova (só com fatos do briefing), carrossel de passos, ` +
    `data comemorativa próxima se fizer sentido. No máximo 1 post de oferta, e só se houver oferta no briefing.\n\n` +
    `Para cada post, devolva um objeto com:\n` +
    `- "tema": 2 a 4 palavras resumindo o assunto (ex.: "dica de horário", "história da fundadora")\n` +
    `- "titulo": o texto grande da arte, até 5 palavras, forte e direto\n` +
    `- "topicos": exatamente 3 itens curtos (2 a 4 palavras cada) que aparecem na arte com um ícone de check\n` +
    `- "legenda": 3 parágrafos curtos separados por linha em branco (total até 400 caracteres): o gancho, ` +
    `o valor para o cliente e a chamada para ação ou pergunta. Sem hashtags dentro da legenda.\n` +
    `- "hashtags": array de 5 hashtags, misturando o nome da marca, o ramo e o assunto\n` +
    `- "prompt_imagem": descrição em INGLÊS para um gerador de imagens criar a arte quadrada do post, no formato:\n` +
    `  "Square Instagram post, professional photographic background: <cena realista ligada ao assunto e ao ramo, sem pessoas identificáveis famosas, sem texto na cena>. ` +
    `Dark semi-transparent overlay using ${cores} so the text stands out. ` +
    `Bold white sans-serif title at the bottom-left reading exactly: '<titulo>'. ` +
    `Below it, 3 lines with small check icons reading exactly: '<topico 1>', '<topico 2>', '<topico 3>'. ` +
    `${logo} Clean, modern, high contrast, no other text, no watermark."\n` +
    `  Os textos entre aspas devem ser idênticos ao titulo e aos topicos, em português, com acentos.\n\n` +
    `Responda SOMENTE um array JSON com ${a.quantidade} objetos, sem comentários.`;

  return { sistema, usuario };
}

export async function criarPosts(a: DadosParaGerar): Promise<PostGerado[]> {
  const { sistema, usuario } = montarPrompt(a);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 8000,
      system: sistema,
      messages: [{ role: "user", content: usuario }],
    }),
  });
  if (!res.ok) {
    // Registra o motivo que a API informou (não contém a chave) para facilitar o diagnóstico
    const erro = await res.json().catch(() => null);
    console.error("Anthropic API erro:", res.status, erro?.error?.type ?? "", erro?.error?.message ?? "");
    throw new Error(`A IA respondeu com erro ${res.status}`);
  }

  const j = await res.json();
  const texto = (j.content ?? []).map((b: any) => b.text ?? "").join("");
  const lista = extrairLista(texto);
  if (!lista || !lista.length) {
    console.error("Resposta da IA fora do formato. stop_reason:", j.stop_reason, "tamanho:", texto.length);
    throw new Error("A IA devolveu uma resposta inválida");
  }

  const limpar = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  return lista.slice(0, a.quantidade).map((p: any) => ({
    tema: limpar(p.tema, 60),
    titulo: limpar(p.titulo, 60),
    topicos: (Array.isArray(p.topicos) ? p.topicos : []).map((t: unknown) => limpar(t, 40)).filter(Boolean).slice(0, 3),
    legenda: limpar(p.legenda, 2000),
    hashtags: (Array.isArray(p.hashtags) ? p.hashtags : [])
      .map((h: unknown) => limpar(h, 40))
      .map((h: string) => (h.startsWith("#") ? h : `#${h.replace(/\s+/g, "")}`))
      .filter((h: string) => h.length > 1)
      .slice(0, 8),
    prompt_imagem: limpar(p.prompt_imagem, 1500),
  })).filter((p: PostGerado) => p.legenda && p.titulo);
}
