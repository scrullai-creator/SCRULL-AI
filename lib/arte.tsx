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

export type Layout = "faixa" | "centro" | "cartao" | "frase";

export type DadosArte = {
  fundoJpeg: Buffer;          // foto gerada pela IA
  layout?: Layout;
  titulo: string;
  subtitulo?: string;
  topicos: string[];
  logo?: { bytes: Buffer; tipo: string } | null;
  nomeEmpresa: string;
  cor: string;                // cor de destaque (hex)
};

// Devolve a arte final em JPEG
export async function montarArte(d: DadosArte): Promise<Buffer> {
  const [f800, f700] = await Promise.all([fonte(800), fonte(700)]);
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
  if (layout === "centro") {
    arte = (
      <div style={{ width: W, height: W, display: "flex", position: "relative", fontFamily: "Jakarta", color: "#fff" }}>
        <img src={fundo} width={W} height={W} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: W, display: "flex", background: "rgba(0,0,0,0.5)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: W, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: "0 90px", textAlign: "center" }}>
          <div style={{ display: "flex", width: 90, height: 8, borderRadius: 8, background: d.cor === "#0b1437" ? "#fff" : d.cor, marginBottom: 34 }} />
          <div style={{ display: "flex", fontSize: tamTitulo + 6, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, textShadow: sombra, justifyContent: "center" }}>{titulo}</div>
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
            <div style={{ display: "flex", fontSize: Math.min(tamTitulo, 66), fontWeight: 800, lineHeight: 1.06, letterSpacing: -1.2 }}>{titulo}</div>
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
          <div style={{ display: "flex", fontSize: tamTitulo + 4, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.2 }}>{titulo}</div>
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
          <div style={{ display: "flex", fontSize: tamTitulo, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5,
            textShadow: sombra, marginBottom: 26 }}>{titulo}</div>
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
      ],
    }
  );
  const pngBytes = Buffer.from(await png.arrayBuffer());
  return sharp(pngBytes).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}
