// Perfis de conteúdo de especialista: dicas de gestão, perfis de profissionais (contador, nutricionista,
// advogado, personal, consultor, mentor...). Cada post é uma mini-aula de quem domina o assunto:
// contexto, explicação, exemplo prático e passo a passo, com legenda longa e bem montada.
import { ehPerfilDeReceitas } from "./receitas";

const RAMOS_ESPECIALISTA =
  /conte[uú]do|dicas|consult|mentor|especialista|gest[aã]o|empreend|neg[oó]cios|contab|contador|advoc|advogad|jur[ií]dic|nutri|psic|terapeut|personal|coach|educa|professor|finan|investiment|marketing digital|carreira|profiss/i;

export function ehPerfilEspecialista(empresa?: string | null, ramo?: string | null): boolean {
  if (/scrull/i.test(empresa ?? "") || ehPerfilDeReceitas(empresa, ramo)) return false;
  return RAMOS_ESPECIALISTA.test(ramo ?? "");
}

export const INSTRUCOES_ESPECIALISTA =
  `ESTE É UM PERFIL DE CONTEÚDO DE ESPECIALISTA. Cada post é uma MINI-AULA de quem domina o assunto e vive isso na prática, ` +
  `nunca uma dica rasa ("organize suas finanças", "tenha disciplina", "acredite no seu sonho") nem frase motivacional.\n` +
  `- ASSUNTOS: um tema específico e aplicável por post, dentro da área do briefing. Para gestão de negócios, gire entre os pilares ` +
  `finanças e fluxo de caixa, precificação e margem, vendas, atendimento e pós-venda, equipe e contratação, marketing e Instagram, ` +
  `rotina e produtividade do dono, indicadores e decisões, erros comuns de quem começa. Para profissionais (contador, nutricionista, advogado, ` +
  `personal...), use a área deles. Pense o lote como uma sequência de aulas: não repita tema do histórico e não repita pilar em posts seguidos.\n` +
  `- PROFUNDIDADE: responda o "por quê" e o "como", não só o "o quê". Mostre o raciocínio de quem sabe (a conta, o critério, o detalhe que o iniciante não vê).\n` +
  `- "legenda" de 1.000 a 1.900 caracteres, sem hashtags dentro, em parágrafos curtos com linha em branco entre eles, nesta estrutura (sem escrever os nomes das partes):\n` +
  `  1) gancho: uma situação concreta que o público vive ou um erro caro e específico (nada de pergunta genérica);\n` +
  `  2) contexto: por que isso acontece, em 2 ou 3 frases;\n` +
  `  3) a explicação de especialista, com um EXEMPLO PRÁTICO de um pequeno negócio real do dia a dia, ` +
  `com números simples de exemplo quando ajudar (deixe claro que é exemplo: "imagina uma loja que fatura R$ 8 mil por mês...");\n` +
  `  4) passo a passo: de 3 a 5 passos numerados ("1." "2." ...), curtos e acionáveis, que a pessoa consegue fazer hoje;\n` +
  `  5) o erro mais comum ou o alerta importante sobre o tema;\n` +
  `  6) fechamento curto aplicando a ideia (varie: convite a salvar para aplicar depois, a mandar para um sócio, a comentar a dúvida, ou sem chamada).\n` +
  `- VARIEDADE DE EXEMPLOS: cada post do lote usa um tipo de negócio diferente no exemplo (loja de roupas, salão de beleza, oficina, clínica, ` +
  `mercadinho, prestador de serviço, escritório, academia, pet shop, ateliê, loja online, restaurante...). No máximo 1 post do lote com exemplo de comida. ` +
  `A história e a experiência pessoal do briefing são pano de fundo: cite em no máximo 1 post do lote, e nunca como exemplo principal de todos.\n` +
  `- NUNCA invente estatística, pesquisa, lei, número oficial ou caso real ("segundo o Sebrae, 60%..."). Números só como exemplo ilustrativo e assumido como exemplo. ` +
  `Em saúde, direito e finanças: sem promessa de resultado, sem diagnóstico, respeitando a ética da profissão.\n` +
  `- Voz: de quem faz e ensina, segura e próxima, como uma consultora experiente conversando com um cliente; sem tom de coach, sem tom de professor arrogante, sem jargão sem explicar.\n` +
  `- "titulo" (até 8 palavras): promete um aprendizado específico e claro ("Como calcular o preço sem chutar", "O erro que esvazia seu caixa no fim do mês"). ` +
  `Proibido título vago ou motivacional.\n` +
  `- "layout": prefira "faixa" (título + 3 pontos-chave) e "cartao" (título + subtítulo), alternando; "frase" no máximo 1 vez no lote, para uma ideia forte. Não use "centro".\n` +
  `- "subtitulo": uma linha concreta que completa o título (para "cartao" e "frase").\n` +
  `- "topicos": para "faixa", os 3 pontos-chave da aula, de 2 a 5 palavras cada (ex.: "Separe conta pessoal", "Calcule a margem", "Revise toda semana"); vazio nos outros.\n` +
  `- "hashtags": de 4 a 6, sobre o tema e o público.\n` +
  `- "prompt_imagem" em INGLÊS: uma foto real e profissional ligada ao tema da aula (ex.: mãos fazendo contas num caderno ao lado de uma calculadora no balcão de uma loja; ` +
  `dona de pequeno negócio organizando pedidos; vitrine de uma loja de bairro), luz natural, sem rostos em close, sem texto na cena.\n`;
