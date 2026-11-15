"use client";
// Escolhe um vídeo do celular, confere tamanho e duração, e envia direto para o Storage.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase-browser";
import { pedirEnvio, confirmarEnvio } from "./videos";

function duracaoDe(arq: File): Promise<number> {
  return new Promise((ok) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    const url = URL.createObjectURL(arq);
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); ok(v.duration || 0); };
    v.onerror = () => { URL.revokeObjectURL(url); ok(0); };
    v.src = url;
  });
}

export function EnviarVideo(p: { restantes: number; maxSegundos: number; maxMb: number; tipos: string[] }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [duracao, setDuracao] = useState(0);
  const [descricao, setDescricao] = useState("");
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const a = e.target.files?.[0];
    setMsg(""); setArquivo(null);
    if (!a) return;
    if (!p.tipos.includes(a.type)) return setMsg("Envie um vídeo MP4 ou MOV (o formato padrão do celular).");
    if (a.size > p.maxMb * 1024 * 1024) return setMsg(`O vídeo tem mais de ${p.maxMb} MB. Grave em 1080p (não em 4K) ou envie um trecho menor.`);
    const d = await duracaoDe(a);
    if (d > p.maxSegundos + 1) return setMsg(`O vídeo tem ${Math.round(d)} segundos. O limite é ${p.maxSegundos} segundos.`);
    setDuracao(d); setArquivo(a);
  }

  async function enviar() {
    if (!arquivo) return;
    setEnviando(true); setMsg("");
    try {
      const r = await pedirEnvio(arquivo.type);
      if (!r.ok) { setMsg(r.msg); return; }
      const { error } = await supabaseNavegador().storage.from("artes")
        .uploadToSignedUrl(r.caminho, r.token, arquivo, { contentType: arquivo.type });
      if (error) { setMsg("O envio falhou. Confira a internet e tente de novo."); return; }
      setMsg(await confirmarEnvio(r.caminho, descricao.trim(), duracao));
      setArquivo(null); setDescricao("");
      if (ref.current) ref.current.value = "";
      router.refresh();
    } catch {
      setMsg("O envio falhou. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  if (p.restantes <= 0) return <small className="dica">Você usou os vídeos deste mês. O limite renova no dia 1.</small>;

  return (
    <div>
      <label className={`btn${enviando ? " pendente" : ""}`} style={{ cursor: enviando ? "progress" : "pointer" }}>
        {arquivo ? "Trocar vídeo" : "Escolher vídeo"}
        <input ref={ref} type="file" accept="video/mp4,video/quicktime" hidden disabled={enviando} onChange={aoEscolher} />
      </label>
      {arquivo && (
        <div style={{ marginTop: 10 }}>
          <small className="dica">{arquivo.name} · {Math.round(duracao)} s · {(arquivo.size / 1048576).toFixed(1)} MB</small>
          <label htmlFor="desc-video">Sobre o que é o vídeo? <small className="dica">Ex.: pizza de calabresa saindo do forno. A IA usa isso para escrever a legenda.</small></label>
          <textarea id="desc-video" className="campo" rows={2} maxLength={500} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          <button type="button" className={`btn${enviando ? " pendente" : ""}`} disabled={enviando} onClick={enviar}>
            {enviando && <span className="giro" aria-hidden="true" />}
            {enviando ? "Enviando… (pode levar 1 minuto)" : "Enviar vídeo"}
          </button>
        </div>
      )}
      {msg && <p className="sub" role="status" style={{ margin: "8px 0 0" }}>{msg}</p>}
    </div>
  );
}
