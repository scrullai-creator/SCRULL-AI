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

export type DadosArte = {
  fundoJpeg: Buffer;          // foto gerada pela IA
  titulo: string;
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

  const png = new ImageResponse(
    (
      <div style={{ width: TAM, height: TAM, display: "flex", position: "relative", fontFamily: "Jakarta", color: "#fff" }}>
        <img src={fundo} width={TAM} height={TAM} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
        {/* escurece a base para o texto ler bem */}
        <div style={{ position: "absolute", top: 0, left: 0, width: TAM, height: TAM, display: "flex",
          background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.72) 72%, rgba(0,0,0,0.9) 100%)" }} />
        {/* faixa diagonal na cor da marca */}
        <div style={{ position: "absolute", top: 0, left: 0, width: TAM, height: TAM, display: "flex",
          background: `linear-gradient(35deg, ${d.cor}f2 0%, ${d.cor}d9 28%, ${d.cor}66 48%, ${d.cor}00 64%)` }} />
        {/* texto */}
        <div style={{ position: "absolute", left: 64, bottom: 64, width: 760, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: tamTitulo, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5,
            textShadow: "0 4px 18px rgba(0,0,0,0.45)", marginBottom: 26 }}>{titulo}</div>
          {d.topicos.slice(0, 3).map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 32, fontWeight: 700, marginTop: 10,
              textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
              <Check cor={d.cor} />
              <span>{t}</span>
            </div>
          ))}
        </div>
        {/* logo ou nome da empresa */}
        {logo ? (
          <div style={{ position: "absolute", right: 48, bottom: 48, display: "flex", padding: 14, borderRadius: 22,
            background: "rgba(255,255,255,0.92)" }}>
            <img src={logo} width={120} height={120} style={{ objectFit: "contain" }} />
          </div>
        ) : (
          <div style={{ position: "absolute", right: 56, bottom: 56, display: "flex", fontSize: 30, fontWeight: 800,
            letterSpacing: 1, textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>{d.nomeEmpresa.toUpperCase()}</div>
        )}
      </div>
    ),
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
