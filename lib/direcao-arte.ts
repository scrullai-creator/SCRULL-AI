// Manual de direção de arte do Scrull: estilos profissionais por segmento.
// Cada cliente cai automaticamente no segmento do ramo dele; o estilo muda de um dia para o outro
// (e a cada troca de arte). As cores e a logo são sempre as da marca do cliente.
// Nenhum estilo depende de outro cliente: é o mesmo manual para qualquer empresa nova.

export type Segmento =
  | "comida" | "moda" | "beleza" | "auto" | "saude" | "servicos" | "varejo" | "casa" | "pet" | "educacao" | "tecnologia" | "geral";

const SEGMENTOS: [Segmento, RegExp][] = [
  ["auto", /moto|carro|auto|oficina|mec[aâ]nic|pneu|bike|bicicleta|lava.?jato|ve[ií]culo/],
  ["comida", /pizza|restaurante|lanch|hamb|doce|confeit|padaria|caf[eé]|a[cç]a[ií]|bar\b|delivery|comida|pudim|bolo|sorvet|marmit|churras|salgad|food|cozinha/],
  ["beleza", /beleza|est[eé]tic|sal[aã]o|unha|manicure|cabel|barbear|barbearia|maquiag|sobrancelha|depila|spa|c[ií]lio/],
  ["moda", /moda|roupa|confec|boutique|joia|semijoia|cal[cç]ado|uniforme|lingerie|acess[oó]rio|bolsa|[oó]tica/],
  ["saude", /academia|fitness|personal|cl[ií]nica|dentist|odonto|fisio|nutri|psic|m[eé]dic|sa[uú]de|pilates|farm[aá]cia/],
  ["pet", /pet|veterin|banho e tosa|ra[cç][aã]o|animal/],
  ["casa", /m[oó]ve|decora|constru|reforma|marcenar|im[oó]ve|imobili|arquitet|jardim|limpeza|material de constru/],
  ["educacao", /escola|curso|aula|idioma|ingl[eê]s|refor[cç]o|educa|treinamento|mentoria/],
  ["tecnologia", /tecnolog|software|app|digital|inform[aá]tic|celular|eletr[oô]n|ag[eê]ncia|marketing|scrull/],
  ["varejo", /mercad|loja|varejo|distribuidor|atacad|papelaria|presente|utilidade|cosm[eé]tico|perfum/],
  ["servicos", /contab|advoc|consult|seguro|financ|cr[eé]dito|despachante|fot[oó]graf|evento|gr[aá]fica|transporte|frete/],
];

export function segmentoDoRamo(ramo: string): Segmento {
  const r = (ramo ?? "").toLowerCase();
  for (const [s, re] of SEGMENTOS) if (re.test(r)) return s;
  return "geral";
}

// Estilos: escritos como direção para um diretor de arte. Sempre com título grande, foto clara
// e nítida do assunto, composição cheia (sem espaço morto) e acabamento de agência.
const ESTILOS: Record<Segmento, string[]> = {
  comida: [
    "Appetizing hero food shot filling most of the frame, close-up with visible texture, steam or freshness, warm natural light; bold headline on a solid color band across the top.",
    "Top-down flat lay of the dish and real ingredients on a rustic surface; headline in a large rounded label in the corner, playful and bold.",
    "Split layout: left half a solid brand-color panel with huge stacked headline, right half a tight close-up of the food.",
    "Lifestyle scene: hands holding or sharing the food, slightly blurred cozy background; huge headline at the bottom over a soft dark gradient.",
  ],
  moda: [
    "Editorial fashion look: product or outfit as the hero on a clean seamless studio background in a brand tone, elegant thin and bold type mix, magazine-cover feel.",
    "Detail shot of fabric, stitching or accessory, macro and sharp; minimal layout with a big bold headline and generous but intentional margins.",
    "Collage of 2–3 product photos in neat rounded frames with a strong headline band; modern catalog style.",
    "Model-free lifestyle: the piece styled on a hanger or table in natural light; headline large with a brand-color underline.",
  ],
  beleza: [
    "Soft, luminous close-up of the result (hair, nails, skin or makeup) with clean pastel background, elegant serif-style headline, refined and airy.",
    "Before/after inspired split composition with a thin divider and bold headline on top (no fake people's faces close-up; focus on hands, hair or products).",
    "Product flat lay of beauty items on marble or linen with soft shadows; headline in a large elegant block.",
    "Salon ambience with blurred warm lights and tools in focus in the foreground; headline large and centered on a translucent card.",
  ],
  auto: [
    "Dramatic hero shot of a motorcycle or car (generic, no brand logos) at a low angle with sharp reflections and strong contrast; huge condensed uppercase headline across the top, sporty and bold.",
    "Workshop action: mechanic's hands with tools on the engine, sharp detail, industrial lighting; headline in a bold diagonal band in the brand color.",
    "Vehicle on an open road at golden hour with motion feel; headline massive at the bottom, high-energy racing typography.",
    "Detail close-up (chrome, tire tread, dashboard) filling the frame; headline in a solid block with a bold accent stripe.",
  ],
  saude: [
    "Clean, bright and trustworthy scene of the service (equipment, workout, consultation space) in sharp focus; strong headline on a white or light card with brand-color accent.",
    "Bold motivational layout: big headline taking half the frame, with a dynamic action photo of the activity (no identifiable faces in close-up).",
    "Infographic-like tip card: large title, 2–3 short checklist items with simple icons, and a supporting photo strip.",
  ],
  pet: [
    "Adorable pet portrait, sharp eyes, playful colorful background in brand tones; bouncy rounded bold headline.",
    "Pet products arranged neatly with a happy pet nearby; headline in a big speech-bubble style shape.",
    "Bath and grooming moment, soft and clean; headline large on a pastel band.",
  ],
  casa: [
    "Beautiful finished interior or project photo, wide and sharp, architectural lighting; elegant large headline on a translucent panel.",
    "Material and texture close-up (wood, tile, fabric) filling the frame; bold minimal headline.",
    "Before-and-after inspired split with clean divider and strong headline.",
  ],
  educacao: [
    "Bright, energetic study scene (notebooks, laptop, books) in sharp focus; big friendly headline with a highlighted keyword.",
    "Tip card style: large title, 2–3 numbered points with simple icons, clean modern layout.",
    "Bold typographic post with a single strong headline over a vivid brand-color background and a small supporting photo.",
  ],
  tecnologia: [
    // 0 = estilo da casa do Scrull (o robô em ação). Volta com frequência: ver ESTILO_DA_CASA
    "Vibrant 3D advertising scene: the friendly purple Scrull robot mascot in the foreground holding a smartphone, actively posting, with heart and like notification bubbles popping out of the screen; " +
      "a beautiful, appetizing or desirable product display of a real small business (bakery counter, boutique rack, salon shelf, workshop) next to it, glowing; " +
      "electric violet-to-blue gradient background with a soft neon frame and depth of field; huge bold white headline at the top with the subtitle right below, handle small in a bottom corner.",
    "Bright and modern: a smartphone in a hand showing a colorful, generic social feed (no readable text), clean light background with soft gradients; huge bold headline at the top.",
    "Vivid electric gradient background (blue to cyan or violet to magenta) with a 3D-style floating phone and abstract shapes; massive headline centered, tech-startup ad style.",
    "Real small-business owner's workspace (shop counter, salon, workshop) in bright daylight with a phone on the counter; headline large on a solid color block.",
    "Clean white layout with bold geometric shapes in brand colors and a big headline; minimal, premium SaaS look.",
    "Night neon tech mood with a glowing phone and light trails; headline large with subtle glow.",
  ],
  varejo: [
    "Products arranged in a vibrant, organized display, sharp and colorful; bold promotional-style headline in a large band.",
    "Single hero product on a bright solid brand-color background with a drop shadow; huge headline.",
    "Store ambience with shelves in soft focus and a product in sharp focus in front; headline large and friendly.",
  ],
  servicos: [
    "Professional and trustworthy: clean workspace or the service in action in sharp focus; strong headline on a solid brand-color card.",
    "Bold typographic tip card with a large question or statement and a small supporting photo.",
    "Checklist layout: big title and 2–3 short items with simple icons, modern corporate style.",
  ],
  geral: [
    "Clear hero photo of the business's product or service in sharp focus, filling the frame; bold large headline on a solid brand-color band.",
    "Split layout: brand-color panel with a huge headline on one side and a tight close-up photo on the other.",
    "Bold typographic post: big headline over a vivid brand-color background with a small supporting photo.",
  ],
};

export function estiloDoPost(segmento: Segmento, agendadoPara: string | null | undefined, trocas: number) {
  const lista = ESTILOS[segmento];
  const dia = Math.floor(Date.parse(agendadoPara ?? "") / 86400000) || 0;
  return lista[(((dia + trocas) % lista.length) + lista.length) % lista.length];
}

// ---------------------------------------------------------------------------
// Memória visual: cada post guarda como foi feito (estilo, enquadramento, layout e uma
// "impressão digital" da imagem). A próxima arte do MESMO cliente evita o que foi usado
// por último. A memória é sempre individual: nunca compara com outro cliente.

export type Visual = {
  segmento?: Segmento;
  estilo?: number;        // índice no manual do segmento
  enquadramento?: number; // índice em ENQUADRAMENTOS
  layout?: string | null;
  origem?: "ia-completa" | "modelo" | "foto-cliente" | "ia-criativa" | "arte-grafica";
  nota?: number;          // nota da revisão de qualidade (0 a 10; -1 = sem revisão)
  hash?: string;          // impressão digital da imagem (64 bits em hexadecimal)
};

// Ângulos e enquadramentos de fotografia publicitária, para a foto não sair sempre igual
export const ENQUADRAMENTOS = [
  "Camera: tight close-up of the main subject, filling the frame, crisp detail and texture.",
  "Camera: top-down flat lay, everything neatly arranged, even soft light.",
  "Camera: 45-degree three-quarter angle, subject sharp, background softly blurred.",
  "Camera: eye-level wide shot showing the place or the context around the subject.",
  "Camera: low angle, subject heroic and dominant, dramatic but natural light.",
  "Camera: hands in action working with or holding the product, natural and candid.",
];

// Escolhe o item menos usado recentemente (o que está há mais tempo sem aparecer).
// "recentes" vem do mais novo para o mais antigo (a arte anterior deste mesmo post entra
// em primeiro, então trocar de arte sempre leva a outra opção). Empates giram com o "gancho".
function menosUsado(total: number, recentes: (number | undefined)[], gancho: number, trocas: number) {
  const ultimoUso = (i: number) => {
    const p = recentes.indexOf(i);
    return p < 0 ? 999 : p; // nunca usado = melhor opção
  };
  const ordem = Array.from({ length: total }, (_, k) => (gancho + trocas + k) % total);
  ordem.sort((a, b) => ultimoUso(b) - ultimoUso(a));
  return ordem[0];
}

// Direção de arte da próxima peça, levando em conta a memória visual do cliente
// Estilo da casa: um visual que a marca quer sempre por perto (no Scrull, o robô em ação com o celular).
// Só vale para o próprio Scrull; para clientes do mesmo segmento esse estilo fica de fora.
// Ele aparece pelo menos 1 vez a cada 3 posts, misturado aos outros estilos, nunca em dois posts seguidos.
export const ESTILO_DA_CASA: Partial<Record<Segmento, number>> = { tecnologia: 0 };

export function escolherDirecao(segmento: Segmento, recentes: Visual[], gancho: number, trocas: number, comEstiloDaCasa = false) {
  const lista = ESTILOS[segmento];
  const doSegmento = recentes.filter((v) => v.segmento === segmento);
  const casa = comEstiloDaCasa ? ESTILO_DA_CASA[segmento] : undefined;
  const ultimos = doSegmento.slice(0, 2).map((v) => v.estilo);
  // O estilo da casa tem o mascote do Scrull: nunca aparece para clientes (cada cliente tem a própria identidade)
  const proibido = comEstiloDaCasa ? undefined : ESTILO_DA_CASA[segmento];
  const permitidos = lista.map((_, i) => i).filter((i) => i !== proibido);
  const k = menosUsado(permitidos.length, doSegmento.map((v) => { const j = permitidos.indexOf(v.estilo ?? -1); return j < 0 ? undefined : j; }), gancho, trocas);
  let estilo = permitidos[k];
  if (casa !== undefined && doSegmento.length > 0 && !ultimos.includes(casa) && trocas === 0) estilo = casa;
  const enquadramento = menosUsado(ENQUADRAMENTOS.length, recentes.map((v) => v.enquadramento), gancho * 7, trocas);
  return { estilo, textoEstilo: lista[estilo], enquadramento, textoEnquadramento: ENQUADRAMENTOS[enquadramento] };
}

// Impressão digital da imagem (dHash 8x8): fotos quase iguais têm impressões quase iguais
export async function impressaoDigital(img: Buffer): Promise<string> {
  const sharp = (await import("sharp")).default;
  const { data } = await sharp(img).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? "1" : "0";
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

// Quantos dos 64 bits diferem: abaixo de ~10 as duas imagens são praticamente a mesma composição
export function distancia(a: string, b: string): number {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

export function parecidaDemais(hash: string, recentes: Visual[], limite = 10) {
  return recentes.some((v) => v.hash && distancia(hash, v.hash) <= limite);
}
