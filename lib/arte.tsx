// Monta a arte final: foto gerada pela IA no fundo + título, tópicos e logo
// escritos pelo próprio app (acento sempre certo, logo sempre igual).
import React from "react";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";

const TAM = 1024;

// Cor de destaque a partir do texto "cores da marca" do briefing
export function corDaMarca(cores?: string): string {
  const t = (cores ?? "").toLowerCase();
  const mapa: [string, string][] = [
    ["roxo", "#5b2bd9"], ["lilás", "#7c3aed"], ["violeta", "#6d28d9"],
    ["azul", "#1d4ed8"], ["verde", "#15803d"], ["vermelh", "#b91c1c"],
    ["laranja", "#c2410c"], ["rosa", "#be185d"], ["amarel", "#ca8a04"],
    ["dourad", "#b45309"], ["marrom", "#78350f"], ["preto", "#111827"],
  ];
  for (const [chave, hex] of mapa) if (t.includes(chave)) return hex;
  return "#0b1437";
}

// As fontes ficam em lib/fontes (incluídas no deploy pelo next.config)
async function fonte(peso: 700 | 800) {
  const arquivo = path.join(process.cwd(), "lib", "fontes", `plus-jakarta-sans-latin-${peso}-normal.woff`);
  const b = await readFile(arquivo);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

function Check({ cor }: { cor: string }) {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="15" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M10 17.5 L15 22.5 L24 12.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type Layout = "faixa" | "centro" | "cartao" | "frase" | "foto" | "marca" | "receita";

export type DadosArte = {
  fundoJpeg: Buffer;          // foto gerada pela IA
  layout?: Layout;
  titulo: string;
  subtitulo?: string;
  topicos: string[];
  logo?: { bytes: Buffer; tipo: string } | null;
  nomeEmpresa: string;
  cor: string;                // cor de destaque (hex)
  fonteTitulo?: FonteTitulo;  // fonte do título, escolhida pelo ramo de cada cliente
  ingredientes?: { grupo: string; itens: string[] }[]; // layout "receita": cartão com a lista de ingredientes
};

// Fonte do título de cada cliente: segue o ramo (fica sempre a mesma para a marca ser reconhecida)
export type FonteTitulo = "Jakarta" | "Outfit" | "Grotesk" | "Sora" | "Bebas";
const ARQ_FONTE: Record<Exclude<FonteTitulo, "Jakarta">, string> = {
  Outfit: "outfit-latin-800-normal.woff", Grotesk: "space-grotesk-latin-700-normal.woff",
  Sora: "sora-latin-800-normal.woff", Bebas: "bebas-neue-latin-400-normal.woff",
};
export function fonteDoRamo(ramo: string, id: string): FonteTitulo {
  const r = ramo.toLowerCase();
  if (/moto|carro|auto|oficina|academia|esporte|fitness|bike|pneu|mec[aâ]nic/.test(r)) return "Bebas";
  if (/tecnolog|software|app|digital|inform[aá]tic|celular|eletr[oô]n/.test(r)) return "Grotesk";
  if (/beleza|est[eé]tic|sal[aã]o|unha|cabel|moda|roupa|confec|boutique|joia|semijoia/.test(r)) return "Outfit";
  if (/pizza|restaurante|lanche|hamb|doce|confeit|padaria|caf[eé]|a[cç]a[ií]|bar\b|delivery|comida|pudim/.test(r)) return "Sora";
  const opcoes: FonteTitulo[] = ["Jakarta", "Outfit", "Grotesk", "Sora"];
  return opcoes[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % opcoes.length];
}

// Devolve a arte final em JPEG
export async function montarArte(d: DadosArte): Promise<Buffer> {
  const ft: FonteTitulo = d.fonteTitulo ?? "Jakarta";
  const [f800, f700, fMarca, fTit] = await Promise.all([
    fonte(800), fonte(700),
    readFile(path.join(process.cwd(), "lib", "fontes", "outfit-latin-500-normal.woff"))
      .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer),
    ft === "Jakarta" ? Promise.resolve(null) : readFile(path.join(process.cwd(), "lib", "fontes", ARQ_FONTE[ft]))
      .then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer),
  ]);
  // Bebas é condensada: letras maiores e em caixa alta
  const tit: React.CSSProperties = ft === "Bebas" ? { fontFamily: "Titulo", fontWeight: 400, textTransform: "uppercase", letterSpacing: 0.5 }
    : ft === "Jakarta" ? {} : { fontFamily: "Titulo" };
  const k = ft === "Bebas" ? 1.3 : 1;
  const fundo = `data:image/jpeg;base64,${d.fundoJpeg.toString("base64")}`;
  const logo = d.logo ? `data:${d.logo.tipo};base64,${d.logo.bytes.toString("base64")}` : null;
  const titulo = d.titulo.trim();
  const tamTitulo = titulo.length > 28 ? 60 : titulo.length > 18 ? 72 : 84;

  const W = TAM;
  const sombra = "0 4px 18px rgba(0,0,0,0.45)";
  const marca = logo ? (
    <div style={{ display: "flex", padding: 12, borderRadius: 20, background: "rgba(255,255,255,0.92)" }}>
      <img src={logo} width={104} height={104} style={{ objectFit: "contain" }} />
    </div>
  ) : (
    <div style={{ display: "flex", fontSize: 28, fontWeight: 800, letterSpacing: 1, textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>
      {d.nomeEmpresa.toUpperCase()}
    </div>
  );
  const sub = (d.subtitulo ?? "").trim();
  const layout = d.layout ?? "faixa";

  let arte: React.ReactElement;
  if (layout === "receita") {
    // Cartão de receita: foto do prato em cima, papel embaixo com o nome da receita e os ingredientes em colunas
    const grupos = (d.ingredientes ?? []).filter((g) => g.itens.length);
    const total = grupos.reduce((n, g) => n + g.itens.length, 0);
    // Sem partes: divide a lista em duas colunas
    let colunas: { grupo: string; itens: string[] }[] = grupos.slice(0, 2);
    if (grupos.length === 1 && total > 5) {
      const metade = Math.ceil(total / 2);
      colunas = [{ grupo: grupos[0].grupo, itens: grupos[0].itens.slice(0, metade) }, { grupo: "", itens: grupos[0].itens.slice(metade) }];
    } else if (grupos.length > 2) {
      colunas = [grupos[0], { grupo: grupos.slice(1).map((g) => g.grupo).filter(Boolean).join(" e "), itens: grupos.slice(1).flatMap((g) => g.itens) }];
    }
    const maior = Math.max(1, ...colunas.map((c) => c.itens.length + (c.grupo ? 1 : 0)));
    const altFoto = maior > 7 ? 430 : maior > 5 ? 470 : maior > 3 ? 540 : 600;
    const tamItem = maior > 7 ? 21 : maior > 4 ? 24 : 28;
    const marrom = "#3b2414";
    const destaque = d.cor === "#0b1437" ? "#8a4b1f" : d.cor;
    const tamNome = titulo.length > 26 ? 44 : titulo.length > 18 ? 52 : 60;
    arte = (
      <div style={{ width: W, height: W, display: "flex", flexDirection: "column", fontFamily: "Jakarta", color: marrom,
        background: "linear-gradient(180deg, #f6eddc 0%, #efe2c9 100%)" }}>
        <img src={fundo} width={W} height={altFoto} style={{ objectFit: "cover" }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "26px 110px 22px", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "center", textAlign: "center", fontSize: tamNome, fontWeight: 800, lineHeight: 1.04,
            letterSpacing: -0.5, textTransform: "uppercase", fontFamily: "Titulo" }}>{titulo}</div>
          {sub && <div style={{ display: "flex", justifyContent: "center", fontSize: 24, fontWeight: 700, marginTop: 6, color: destaque }}>{sub}</div>}
          <div style={{ display: "flex", width: "100%", height: 0, borderTop: `3px dashed ${marrom}55`, margin: "14px 0 12px" }} />
          <div style={{ display: "flex", flex: 1, gap: 34 }}>
            {colunas.map((c, ci) => (
              <div key={ci} style={{ display: "flex", flexDirection: "column", flex: 1,
                ...(ci > 0 ? { borderLeft: `2px dashed ${marrom}55`, paddingLeft: 30 } : {}) }}>
                {c.grupo && <div style={{ display: "flex", fontSize: tamItem + 5, fontWeight: 800, color: destaque, marginBottom: 4 }}>{c.grupo}:</div>}
                {c.itens.map((t, i) => (
                  <div key={i} style={{ display: "flex", fontSize: tamItem, fontWeight: 700, lineHeight: 1.22, marginTop: 5 }}>
                    <span style={{ display: "flex", marginRight: 10, color: destaque }}>•</span>
                    <span style={{ display: "flex", flex: 1 }}>{t}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", right: 110, bottom: 14, display: "flex", fontFamily: "Marca", fontSize: 17, letterSpacing: 4,
            color: `${marrom}88` }}>{d.nomeEmpresa.toUpperCase()}</div>
        </div>
      </div>
    );
  } else if (layout === "foto") {
    // Foto limpa, sem texto nem escurecimento por cima: o assunto fica na legenda. Só o selo da logo, se houver.
    arte = (
      <div style={{ width: W, height: W, display: "flex", position: "relative" }}>
        <img src={fundo} width={W} height={W} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
        {logo ? (
          <div style={{ position: "absolute", right: 40, bottom: 40, display: "flex" }}>{marca}</div>
        ) : (
          // Marca d'água discreta com o nome do negócio, aplicada pelo app (nunca pedida à IA de imagem)
          <div style={{ position: "absolute", right: 36, bottom: 30, display: "flex", fontFamily: "Marca", fontSize: 22, fontWeight: 500,
            letterSpacing: 5, color: "rgba(255,255,255,0.5)", textShadow: "0 1px 5px rgba(0,0,0,0.22)" }}>{d.nomeEmpresa.toUpperCase()}</div>
        )}
      </div>
    );
  } else if (layout === "marca") {
    // Arte gráfica da marca, sem foto: cor, título grande e nome/logo. Usada quando não há foto real do produto.
    arte = (
      <div style={{ width: W, height: W, display: "flex", position: "relative", fontFamily: "Jakarta", color: "#fff",
        background: `linear-gradient(145deg, ${d.cor} 0%, ${d.cor}cc 100%)` }}>
        <div style={{ position: "absolute", top: -160, right: -160, width: 520, height: 520, borderRadius: 520, background: "rgba(255,255,255,0.10)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -200, left: -140, width: 480, height: 480, borderRadius: 480, background: "rgba(255,255,255,0.07)", display: "flex" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: W, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 110px" }}>
          <div style={{ display: "flex", width: 96, height: 8, borderRadius: 8, background: "#fff", marginBottom: 40 }} />
          <div style={{ display: "flex", fontSize: (tamTitulo + 4) * k, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5, ...tit }}>{titulo}</div>
          {sub && <div style={{ display: "flex", fontSize: 34, fontWeight: 700, marginTop: 28, opacity: 0.9 }}>{sub}</div>}
        </div>
        <div style={{ position: "absolute", left: 110, bottom: 70, display: "flex" }}>{marca}</div>
      </div>
    );
  } else if (layout === "centro") {
    arte = (
      <div style={{ width: W, height: W, display: "flex", position: "relative", fontFamily: "Jakarta", color: "#fff" }}>
        <img src={fundo} width={W} height={W} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: W, display: "flex", background: "rgba(0,0,0,0.5)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: W, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: "0 90px", textAlign: "center" }}>
          <div style={{ display: "flex", width: 90, height: 8, borderRadius: 8, background: d.cor === "#0b1437" ? "#fff" : d.cor, marginBottom: 34 }} />
          <div style={{ display: "flex", fontSize: (tamTitulo + 6) * k, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, textShadow: sombra, justifyContent: "center", ...tit }}>{titulo}</div>
          {sub && <div style={{ display: "flex", fontSize: 34, fontWeight: 700, marginTop: 26, opacity: 0.92, textShadow: sombra, justifyContent: "center" }}>{sub}</div>}
        </div>
        <div style={{ position: "absolute", left: 0, bottom: 44, width: W, display: "flex", justifyContent: "center" }}>{marca}</div>
      </div>
    );
  } else if (layout === "cartao") {
    const alt = 600;
    arte = (
      <div style={{ width: W, height: W, display: "flex", flexDirection: "column", fontFamily: "Jakarta", color: "#fff", background: d.cor }}>
        <img src={fundo} width={W} height={alt} style={{ objectFit: "cover" }} />
        <div style={{ display: "flex", flex: 1, padding: "38px 56px", alignItems: "center", justifyContent: "space-between", gap: 30 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: Math.min(tamTitulo, 66) * k, fontWeight: 800, lineHeight: 1.06, letterSpacing: -1.2, ...tit }}>{titulo}</div>
            {sub && <div style={{ display: "flex", fontSize: 30, fontWeight: 700, marginTop: 14, opacity: 0.85 }}>{sub}</div>}
          </div>
          {marca}
        </div>
      </div>
    );
  } else if (layout === "frase") {
    arte = (
      <div style={{ width: W, height: W, display: "flex", position: "relative", fontFamily: "Jakarta", color: "#fff", background: d.cor }}>
        <img src={fundo} width={W} height={W} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover", opacity: 0.22 }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: W, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 96px" }}>
          <div style={{ display: "flex", fontSize: 220, fontWeight: 800, lineHeight: 0.6, opacity: 0.35, marginBottom: 10 }}>“</div>
          <div style={{ display: "flex", fontSize: (tamTitulo + 4) * k, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.2, ...tit }}>{titulo}</div>
          {sub && <div style={{ display: "flex", fontSize: 32, fontWeight: 700, marginTop: 24, opacity: 0.85 }}>{sub}</div>}
        </div>
        <div style={{ position: "absolute", right: 56, bottom: 52, display: "flex" }}>{marca}</div>
      </div>
    );
  } else {
    arte = (
      <div style={{ width: TAM, height: TAM, display: "flex", position: "relative", fontFamily: "Jakarta", color: "#fff" }}>
        <img src={fundo} width={TAM} height={TAM} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: TAM, height: TAM, display: "flex",
          background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.72) 72%, rgba(0,0,0,0.9) 100%)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: TAM, height: TAM, display: "flex",
          background: `linear-gradient(35deg, ${d.cor}f2 0%, ${d.cor}d9 28%, ${d.cor}66 48%, ${d.cor}00 64%)` }} />
        <div style={{ position: "absolute", left: 64, bottom: 64, width: 760, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: tamTitulo * k, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5,
            textShadow: sombra, marginBottom: 26, ...tit }}>{titulo}</div>
          {d.topicos.slice(0, 3).map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 32, fontWeight: 700, marginTop: 10,
              textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
              <Check cor={d.cor} />
              <span>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", right: 48, bottom: 48, display: "flex" }}>{marca}</div>
      </div>
    );
  }

  const png = new ImageResponse(
    arte,
    {
      width: TAM, height: TAM,
      fonts: [
        { name: "Jakarta", data: f800, weight: 800, style: "normal" },
        { name: "Jakarta", data: f700, weight: 700, style: "normal" },
        { name: "Marca", data: fMarca, weight: 500, style: "normal" },
        ...(fTit ? [{ name: "Titulo", data: fTit, weight: (ft === "Bebas" ? 400 : 800) as 400 | 800, style: "normal" as const }] : []),
      ],
    }
  );
  const pngBytes = Buffer.from(await png.arrayBuffer());
  return sharp(pngBytes).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}
