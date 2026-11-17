// O "cérebro" do Scrull AI: lê o briefing da marca e o histórico de posts,
// decide o tema de cada post e escreve título, tópicos, legenda, hashtags
// e a descrição da imagem (que outro serviço transforma em arte).
import { type Briefing, briefingParaPrompt } from "./briefing";

const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";

export const LAYOUTS = ["faixa", "centro", "cartao", "frase"] as const;
export type Layout = (typeof LAYOUTS)[number];

export type PostGerado = {
  tema: string;
  layout: Layout;
  titulo: string;
  subtitulo: string;
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
  // Resumo do Instagram do cliente (legendas e engajamento) e fotos de referência
  perfil?: string;
  fotosDoPerfil?: string[];
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

// O próprio Scrull AI usa o app para o Instagram dele (@scrull.ai): posts institucionais,
// que vendem o app para pequenos negócios, com a identidade do Scrull (roxo escuro, neon, robô).
const SCRULL_INSTITUCIONAL =
  `ESTES SÃO POSTS INSTITUCIONAIS DO PRÓPRIO SCRULL AI, o app que cria, agenda e posta no Instagram de pequenos negócios ` +
  `("Seu Instagram no automático!"). O público são donos de pequenos negócios de qualquer ramo, sem tempo para pensar no que postar. ` +
  `Assuntos: constância que gera lembrança e vendas, o custo de ficar sem postar, como o Scrull funciona (briefing, artes, aprovação opcional, ` +
  `postagem automática), sai mais barato que assinar várias IAs ou contratar alguém, bastidores do app, dicas de Instagram para negócios. ` +
  `A pizzaria é só a origem da história da fundadora: no máximo 1 post a cada várias semanas sobre isso, e NUNCA foto de pizza, comida ou restaurante. ` +
  `Tom leve e confiante, nunca radical (evite "odeio", "pavor", "desespero"). ` +
  `"prompt_imagem": uma cena concreta e atraente de um pequeno negócio real (doceria, loja de roupas, salão, oficina, ateliê, mercadinho...), ` +
  `com um produto específico e bonito, e o mascote robô roxo do Scrull FAZENDO a ação do post (fotografando o produto com o celular, ` +
  `agendando posts num tablet, arrumando a vitrine, comemorando curtidas); nunca objetos genéricos nem o robô parado; sem telas com texto legível. `;

export function montarPrompt(a: DadosParaGerar): { sistema: string; usuario: string } {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo",
  });
  const historico = a.historico.length
    ? a.historico.map((p) => `- ${p.titulo}${p.tema ? ` (${p.tema})` : ""}`).join("\n")
    : "(nenhum post ainda: esta é a primeira semana da conta, então apresente a empresa)";
  const sistema =
    `Você é a social media criativa de uma agência brasileira que cuida do Instagram de pequenos negócios. ` +
    `Você conhece a empresa pelo briefing e pelo próprio Instagram dela, e planeja o feed como uma conversa com o público, ` +
    `não como uma linha de produção. Escreve em português do Brasil como gente de verdade escreve no Instagram: ` +
    `com calor, ritmo e personalidade, sem soar robótico, sem fórmula repetida, sem clichês de IA ("no mundo de hoje", ` +
    `"potencialize", "descubra", "transforme"). ` +
    `Nunca inventa preços, endereços, telefones, números de clientes, prêmios ou depoimentos. ` +
    `Só fala de oferta se o briefing tiver uma. Responde SOMENTE com JSON válido.`;

  const usuario =
    `EMPRESA: ${a.empresa}\nRAMO: ${a.ramo}\nTOM DE VOZ: ${a.tom}\nHOJE: ${hoje}\n\n` +
    `BRIEFING DA MARCA:\n${briefingParaPrompt(a.briefing)}\n\n` +
    `O INSTAGRAM ATUAL DA EMPRESA (aprenda a voz, os assuntos e o que o público mais curte; ` +
    `mantenha o que funciona, melhore o resto, não copie frases):\n${a.perfil ?? "(perfil não conectado)"}\n` +
    (a.fotosDoPerfil?.length ? `As imagens anexadas são fotos reais do perfil: use-as para entender o produto, o ambiente e o estilo visual da marca.\n` : "") +
    `\nPOSTS JÁ CRIADOS PELO SCRULL (não repita estes assuntos):\n${historico}\n\n` +
    `TAREFA: crie ${a.quantidade} posts de feed para os próximos dias. Cada post precisa parecer diferente do anterior, ` +
    `no assunto, no formato da arte e no jeito da legenda.\n\n` +
    `VARIEDADE OBRIGATÓRIA:\n` +
    `- Assuntos: misture produto em destaque, bastidores, dica útil, curiosidade, história da marca, pergunta ao público, ` +
    `quebra de objeção, data comemorativa próxima (se fizer sentido), humor leve do dia a dia do ramo, prova real (só com fatos do briefing). ` +
    `No máximo 1 post de oferta, e só se houver oferta no briefing.\n` +
    `- "layout" da arte, alternando e nunca repetindo o mesmo em dois posts seguidos:\n` +
    `  "faixa" = foto com título grande e até 3 tópicos curtos (bom para listas e benefícios);\n` +
    `  "centro" = foto marcante com uma frase forte centralizada (bom para emoção, novidade, convite);\n` +
    `  "cartao" = foto em cima e um bloco de cor embaixo com título e subtítulo (bom para dica e informação);\n` +
    `  "frase" = fundo na cor da marca com uma frase grande, estilo citação (bom para reflexão, humor, pergunta).\n` +
    `- IDENTIDADE: os posts representam SOMENTE a empresa ${a.empresa}, com o estilo do ramo e do perfil DELA. Nunca use como modelo o estilo de outra empresa. ` +
    (/scrull/i.test(a.empresa) ? SCRULL_INSTITUCIONAL :
      `Nunca cite o Scrull AI, nunca use mascote, robô, logotipo ou elementos de identidade do Scrull, e nunca use o roxo/tecnológico do Scrull por padrão: ` +
      `use as cores, o estilo e a linguagem desta empresa (roxo só se o briefing pedir). `) +
    `As fotos de "prompt_imagem" nunca incluem robôs, mascotes ou ícones de IA, a menos que o ramo seja tecnologia.\n` +
    `- ESTILO DO SEGMENTO (adapte ao ramo da empresa; nunca imponha o visual do Scrull): ` +
    `mercadinho/varejo = cores vibrantes, produtos em destaque, linguagem popular e próxima; ` +
    `confecção/uniformes = produto limpo, detalhe do tecido e da costura, tom profissional; ` +
    `motos/carros/oficina = a moto ou o carro real em destaque, detalhes de cromado e pintura, estrada, atitude; nunca invente modelo, ano, preço ou condição de pagamento; ` +
    `restaurante/pizzaria/delivery = foto apetitosa, cores quentes, vapor, ingredientes, convite para pedir; ` +
    `beleza/estética = luz suave, tons delicados, elegância e cuidado; ` +
    `tecnologia/educação = tons frios, gradientes, composição moderna e objetiva; ` +
    `serviços = confiança, autoridade, dica prática. ` +
    `Alterne também o TIPO do post: lançamento, dica ou tutorial, bastidores, data especial, frase de engajamento, pergunta ao público e prova real.\n` +
    `- Legendas: varie o tamanho (algumas de 1 ou 2 linhas, outras com 3 ou 4 parágrafos curtos), o começo ` +
    `(nem sempre pergunta, nem sempre "Você sabia"), o final (convite, pergunta, frase de efeito, chamada para o direct) ` +
    `e o uso de emoji conforme o tom e o que o perfil já usa.\n\n` +
    `Para cada post, devolva um objeto com:\n` +
    `- "tema": 2 a 4 palavras resumindo o assunto\n` +
    `- "layout": um de "faixa", "centro", "cartao", "frase"\n` +
    `- "titulo": o texto grande da arte, até 7 palavras, com personalidade\n` +
    `- "subtitulo": uma linha curta de apoio (até 10 palavras) para "centro" e "cartao"; vazio nos outros\n` +
    `- "topicos": para "faixa", de 2 a 3 itens curtos (2 a 4 palavras); para os outros layouts, lista vazia\n` +
    `- "legenda": o texto do post, até 600 caracteres, sem hashtags dentro\n` +
    `- "hashtags": de 3 a 6 hashtags, misturando o nome da marca, o ramo, o assunto e a cidade se o briefing disser\n` +
    `- "prompt_imagem": em INGLÊS, 1 a 2 frases descrevendo uma FOTO realista para a arte, ligada ao assunto e ao produto real ` +
    `da empresa (use as fotos do perfil como referência de produto e ambiente), variando enquadramento, luz e cenário entre os posts ` +
    `(close de produto, ambiente, mãos trabalhando, detalhe, vista de cima, pessoa de costas). Sem rostos famosos, sem marcas conhecidas, ` +
    `SEM texto ou logos na cena. Para "frase", descreva uma textura ou detalhe sutil do ramo.\n\n` +
    `Responda SOMENTE um array JSON com ${a.quantidade} objetos, sem comentários.`;

  return { sistema, usuario };
}

export async function criarPosts(a: DadosParaGerar): Promise<PostGerado[]> {
  const { sistema, usuario } = montarPrompt(a);

  const chamar = (comFotos: boolean) => {
    const fotos = comFotos ? (a.fotosDoPerfil ?? []).slice(0, 6) : [];
    const content = fotos.length
      ? [...fotos.map((url) => ({ type: "image", source: { type: "url", url } })), { type: "text", text: usuario }]
      : usuario;
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 8000,
        temperature: 1,
        system: sistema,
        messages: [{ role: "user", content }],
      }),
    });
  };

  let res = await chamar(true);
  // Se alguma foto do perfil não abrir, tenta de novo só com o texto
  if (res.status === 400 && a.fotosDoPerfil?.length) {
    console.error("Criação com fotos do perfil falhou; tentando só com texto");
    res = await chamar(false);
  }
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
  return lista.slice(0, a.quantidade).map((p: any, i: number) => ({
    tema: limpar(p.tema, 60),
    layout: (LAYOUTS as readonly string[]).includes(p.layout) ? p.layout : LAYOUTS[i % LAYOUTS.length],
    titulo: limpar(p.titulo, 80),
    subtitulo: limpar(p.subtitulo, 90),
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
