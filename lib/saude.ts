// Negócios de saúde (laboratório de análises clínicas, clínica, consultório, farmácia, odontologia, fisioterapia,
// nutrição, psicologia...): a propaganda segue as regras dos conselhos profissionais. Estas regras entram em todos
// os posts desses clientes, no modo normal e no modo especialista.

const RAMOS_SAUDE =
  /laborat|an[aá]lises cl[ií]nicas|cl[ií]nica|consult[oó]rio|m[eé]dic|farm[aá]cia|drogaria|odonto|dentist|fisio|nutri|psic|fonoaudi|enfermag|vacina|diagn[oó]stic|exame|sa[uú]de/i;

export function ehSaude(ramo?: string | null): boolean {
  return RAMOS_SAUDE.test(ramo ?? "");
}

export const REGRAS_SAUDE =
  `NEGÓCIO DE SAÚDE: siga as regras de publicidade dos conselhos profissionais (CFM, CFF, CFBM, CFO, CRN, CFP...).\n` +
  `- Nunca prometa cura, resultado ou garantia; nunca faça diagnóstico, nem sugira que um exame ou tratamento substitui a consulta. ` +
  `Quando falar de sintomas ou resultados, oriente a procurar o médico ou o profissional responsável.\n` +
  `- Sem sensacionalismo, medo ou alarme ("você pode estar doente e não sabe!"), sem antes e depois, sem depoimento de paciente, ` +
  `sem comparar preço com concorrente e sem "o melhor", "o mais barato", "100% garantido".\n` +
  `- Informação correta e prudente: em preparo de exames, use orientações gerais e diga para confirmar com o laboratório ou o médico ` +
  `(o jejum e os cuidados podem variar por exame). Nunca invente valores de referência, estatísticas ou prazos.\n` +
  `- Imagens ("prompt_imagem"): ambiente limpo, claro e acolhedor, equipe de costas ou com as mãos em ação, equipamentos, recepção, tubos de coleta organizados; ` +
  `NUNCA paciente identificável, sangue, agulha perfurando a pele, ferida ou cena que cause aflição.\n` +
  `- MIX DE CONTEÚDO (para laboratórios e clínicas): preparo de exames (jejum, o que pode comer, horário), "para que serve este exame" explicado de um jeito simples, ` +
  `serviços e facilidades (só os que estiverem no briefing: coleta domiciliar, convênios, resultado online, horários), campanhas de saúde do mês ` +
  `(Janeiro Branco, Outubro Rosa, Novembro Azul...) quando estiverem próximas, cuidados e prevenção, bastidores da equipe e da qualidade. ` +
  `No máximo 1 post do lote sobre serviços ou oferta.\n`;
