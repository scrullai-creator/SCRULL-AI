// Artes institucionais do próprio Scrull AI (@scrull.ai).
// Visual de tecnologia, mas variado: cada modelo tem paleta, fonte e posição de texto próprias,
// e o modelo muda de um dia para o outro (e a cada "Trocar a arte").
import React from "react";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";

const W = 1024;

type Dados = { foto: string; titulo: string; sub: string; topicos: string[]; mascote: string | null };
type Modelo = { nome: string; luz: string; montar: (d: Dados) => React.ReactElement };

// Iluminação da foto de fundo pedida à IA, combinando com cada modelo
const SEM = " No food, no pizza, no robots, no readable text.";

const tam = (t: string, grande: number, medio: number, pequeno: number) =>
  t.length > 30 ? pequeno : t.length > 18 ? medio : grande;

const Marca = ({ cor, fonte = "Mono" }: { cor: string; fonte?: string }) => (
  <div style={{ display: "flex", fontFamily: fonte, fontSize: 24, letterSpacing: 2, color: cor }}>SCRULL AI</div>
);

const Mascote = ({ src, tamanho, estilo }: { src: string | null; tamanho: number; estilo: React.CSSProperties }) =>
  src ? <img src={src} width={tamanho} height={tamanho} style={{ position: "absolute", ...estilo }} /> : null;

export const MODELOS: Modelo[] = [
  // 1) Azul elétrico: título enorme centralizado, letras condensadas
  {
    nome: "eletrico",
    luz: " Bright electric blue and cyan lighting, clean modern tech mood.",
    montar: (d) => (
      <div style={{ width: W, height: W, display: "flex", position: "relative", backgroundImage: "linear-gradient(135deg, #1d4ed8 0%, #0891b2 100%)" }}>
        <img src={d.foto} width={W} height={W} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover", opacity: 0.28 }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: W, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 80px", textAlign: "center" }}>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 26, color: "#a5f3fc", marginBottom: 18 }}>{"// seu instagram no automático"}</div>
          <div style={{ display: "flex", fontFamily: "Bebas", fontSize: tam(d.titulo, 170, 140, 112), lineHeight: 0.95, color: "#ffffff", textTransform: "uppercase", justifyContent: "center" }}>{d.titulo}</div>
          {d.sub && <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 500, fontSize: 36, color: "#e0f2fe", marginTop: 22, justifyContent: "center" }}>{d.sub}</div>}
        </div>
        <Mascote src={d.mascote} tamanho={120} estilo={{ bottom: 40, left: 452 }} />
      </div>
    ),
  },
  // 2) Lavanda clara: texto à esquerda, foto à direita
  {
    nome: "lavanda",
    luz: " Bright airy daylight, soft lavender and white tones, clean minimal workspace.",
    montar: (d) => (
      <div style={{ width: W, height: W, display: "flex", background: "#f4f0ff" }}>
        <div style={{ width: 560, height: W, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "80px 50px 70px 70px" }}>
          <Marca cor="#7c3aed" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: "Grotesk", fontSize: tam(d.titulo, 84, 70, 58), lineHeight: 1.04, letterSpacing: -2, color: "#2e1065" }}>{d.titulo}</div>
            {d.sub && <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 500, fontSize: 32, color: "#5b21b6", marginTop: 22 }}>{d.sub}</div>}
            {d.topicos.slice(0, 3).map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", fontFamily: "Outfit", fontWeight: 500, fontSize: 30, color: "#3b0764", marginTop: 14 }}>
                <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: "#8b5cf6", marginRight: 16 }} />{t}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", width: 90, height: 8, borderRadius: 4, background: "#8b5cf6" }} />
        </div>
        <div style={{ display: "flex", position: "relative", width: 464, height: W }}>
          <img src={d.foto} width={464} height={W} style={{ objectFit: "cover", borderTopLeftRadius: 60, borderBottomLeftRadius: 60 }} />
          <Mascote src={d.mascote} tamanho={130} estilo={{ bottom: 40, left: -65 }} />
        </div>
      </div>
    ),
  },
  // 3) Branco tech: foto em círculo, título embaixo, faixa em degradê
  {
    nome: "branco",
    luz: " Bright white studio, clean minimal tech aesthetic, natural light.",
    montar: (d) => (
      <div style={{ width: W, height: W, display: "flex", position: "relative", background: "#ffffff" }}>
        <img src={d.foto} width={470} height={470} style={{ position: "absolute", top: 70, right: 70, objectFit: "cover", borderRadius: 235, border: "10px solid #ede9fe" }} />
        <div style={{ position: "absolute", top: 80, left: 80, display: "flex", fontFamily: "Mono", fontSize: 26, color: "#7c3aed" }}>{"> scrull.ai"}</div>
        <Mascote src={d.mascote} tamanho={110} estilo={{ top: 150, left: 70 }} />
        <div style={{ position: "absolute", left: 80, bottom: 90, width: 860, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", width: 220, height: 10, borderRadius: 5, backgroundImage: "linear-gradient(90deg, #7c3aed, #06b6d4)", marginBottom: 28 }} />
          <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 800, fontSize: tam(d.titulo, 92, 76, 62), lineHeight: 1.02, letterSpacing: -2, color: "#111827" }}>{d.titulo}</div>
          {d.sub && <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 500, fontSize: 32, color: "#4b5563", marginTop: 18 }}>{d.sub}</div>}
        </div>
      </div>
    ),
  },
  // 4) Neon escuro: foto inteira, título no alto à esquerda, borda neon
  {
    nome: "neon",
    luz: " Deep dark purple and violet neon lighting, night mood, modern.",
    montar: (d) => (
      <div style={{ width: W, height: W, display: "flex", position: "relative" }}>
        <img src={d.foto} width={W} height={W} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: W, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(30,6,60,0.88) 0%, rgba(30,6,60,0.35) 55%, rgba(30,6,60,0.7) 100%)" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: W, display: "flex", border: "6px solid #c084fc" }} />
        <div style={{ position: "absolute", top: 90, left: 80, width: 800, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: "Sora", fontSize: tam(d.titulo, 86, 72, 60), lineHeight: 1.05, letterSpacing: -1.5, color: "#ffffff", textShadow: "0 0 28px rgba(192,132,252,0.8)" }}>{d.titulo}</div>
          {d.sub && <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 500, fontSize: 34, color: "#e9d5ff", marginTop: 20 }}>{d.sub}</div>}
        </div>
        <div style={{ position: "absolute", left: 80, bottom: 70, display: "flex" }}><Marca cor="#e9d5ff" /></div>
        <Mascote src={d.mascote} tamanho={150} estilo={{ bottom: 40, right: 40 }} />
      </div>
    ),
  },
  // 5) Magenta e violeta: foto à esquerda, degradê forte à direita, texto alinhado à direita
  {
    nome: "magenta",
    luz: " Vibrant magenta and violet lighting, energetic, modern small business.",
    montar: (d) => (
      <div style={{ width: W, height: W, display: "flex", position: "relative" }}>
        <img src={d.foto} width={W} height={W} style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: W, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(192,38,211,0) 15%, rgba(192,38,211,0.75) 50%, rgba(109,40,217,0.97) 80%)" }} />
        <div style={{ position: "absolute", top: 0, right: 80, width: 600, height: W, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", textAlign: "right" }}>
          <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 800, fontSize: tam(d.titulo, 88, 74, 60), lineHeight: 1.02, letterSpacing: -1.5, color: "#ffffff", justifyContent: "flex-end" }}>{d.titulo}</div>
          {d.sub && <div style={{ display: "flex", fontFamily: "Outfit", fontWeight: 500, fontSize: 32, color: "#fae8ff", marginTop: 20, justifyContent: "flex-end" }}>{d.sub}</div>}
          <div style={{ display: "flex", marginTop: 36, padding: "14px 26px", borderRadius: 40, background: "#ffffff", fontFamily: "Outfit", fontWeight: 800, fontSize: 26, color: "#86198f" }}>@scrull.ai</div>
        </div>
        <Mascote src={d.mascote} tamanho={120} estilo={{ top: 40, left: 40 }} />
      </div>
    ),
  },
  // 6) Terminal ciano: cartão com cara de código, foto em faixa no topo
  {
    nome: "terminal",
    luz: " Cool cyan screen glow, modern tech desk, blue hour.",
    montar: (d) => (
      <div style={{ width: W, height: W, display: "flex", flexDirection: "column", background: "#0b1324" }}>
        <img src={d.foto} width={W} height={380} style={{ objectFit: "cover" }} />
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", padding: "0 80px", position: "relative" }}>
          <div style={{ display: "flex", fontFamily: "Mono", fontSize: 28, color: "#22d3ee", marginBottom: 18 }}>{"$ scrull --postar"}</div>
          <div style={{ display: "flex", fontFamily: "Grotesk", fontSize: tam(d.titulo, 80, 68, 56), lineHeight: 1.05, letterSpacing: -1.5, color: "#f8fafc" }}>{d.titulo}</div>
          {d.sub && <div style={{ display: "flex", fontFamily: "Mono", fontSize: 28, color: "#94a3b8", marginTop: 18 }}>{d.sub}</div>}
          <Mascote src={d.mascote} tamanho={130} estilo={{ right: 60, bottom: 50 }} />
        </div>
      </div>
    ),
  },
];

// Modelo do dia: posts de dias seguidos têm modelos diferentes, e cada troca passa para o próximo
export function modeloScrull(agendadoPara: string | null | undefined, trocas: number) {
  const dia = Math.floor(Date.parse(agendadoPara ?? "") / 86400000) || 0;
  return MODELOS[(((dia + trocas) % MODELOS.length) + MODELOS.length) % MODELOS.length];
}

async function fonte(arquivo: string) {
  const b = await readFile(path.join(process.cwd(), "lib", "fontes", arquivo));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

export async function montarArteScrull(modelo: Modelo, d: { fotoJpeg: Buffer; titulo: string; subtitulo?: string; topicos: string[]; mascote: Buffer | null }) {
  const [sora, grotesk, bebas, mono, outfit8, outfit5] = await Promise.all([
    fonte("sora-latin-800-normal.woff"), fonte("space-grotesk-latin-700-normal.woff"), fonte("bebas-neue-latin-400-normal.woff"),
    fonte("jetbrains-mono-latin-500-normal.woff"), fonte("outfit-latin-800-normal.woff"), fonte("outfit-latin-500-normal.woff"),
  ]);
  const el = modelo.montar({
    foto: `data:image/jpeg;base64,${d.fotoJpeg.toString("base64")}`,
    titulo: d.titulo.trim(), sub: (d.subtitulo ?? "").trim(), topicos: d.topicos,
    mascote: d.mascote ? `data:image/png;base64,${d.mascote.toString("base64")}` : null,
  });
  const png = new ImageResponse(el, {
    width: W, height: W,
    fonts: [
      { name: "Sora", data: sora, weight: 800, style: "normal" },
      { name: "Grotesk", data: grotesk, weight: 700, style: "normal" },
      { name: "Bebas", data: bebas, weight: 400, style: "normal" },
      { name: "Mono", data: mono, weight: 500, style: "normal" },
      { name: "Outfit", data: outfit8, weight: 800, style: "normal" },
      { name: "Outfit", data: outfit5, weight: 500, style: "normal" },
    ],
  });
  return sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

export const LUZ_SEM = SEM;
