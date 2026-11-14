// Pede à IA os posts da semana. Usa o modelo mais econômico por padrão.
const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";

export type PostGerado = { titulo: string; legenda: string; hashtags: string[] };

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

export async function criarPosts(a: {
  empresa: string; ramo: string; tom: string; quantidade: number;
}): Promise<PostGerado[]> {
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const prompt =
    `Você é social media de uma agência no Brasil. Empresa: ${a.empresa}. Ramo: ${a.ramo}. ` +
    `Tom de voz: ${a.tom}. Hoje é ${hoje}; considere datas comemorativas próximas, se fizer sentido. ` +
    `Crie ${a.quantidade} posts de feed do Instagram, todos diferentes (produto, bastidores, dica, ` +
    `promoção, prova social, pergunta ao público, carrossel). Não invente preços, endereços nem telefones. ` +
    `Responda SOMENTE um array JSON com ${a.quantidade} objetos: ` +
    `"titulo" (texto curto da arte, até 5 palavras), "legenda" (português do Brasil, até 300 caracteres, ` +
    `termina com pergunta ou chamada para ação) e "hashtags" (array de 4 a 6 hashtags).`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
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
  if (!lista) {
    console.error("Resposta da IA fora do formato. stop_reason:", j.stop_reason, "tamanho:", texto.length);
    throw new Error("A IA devolveu uma resposta inválida");
  }
  if (!Array.isArray(lista) || !lista.length) throw new Error("Resposta da IA fora do formato");

  return lista.slice(0, a.quantidade).map((p: any) => ({
    titulo: String(p.titulo ?? "").slice(0, 60),
    legenda: String(p.legenda ?? "").slice(0, 600),
    hashtags: (Array.isArray(p.hashtags) ? p.hashtags : [])
      .map((h: any) => String(h).trim())
      .filter((h: string) => h.startsWith("#"))
      .slice(0, 8),
  })).filter((p: PostGerado) => p.legenda);
}
