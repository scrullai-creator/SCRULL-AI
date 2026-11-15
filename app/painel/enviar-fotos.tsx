"use client";
// Escolhe fotos do celular/computador, reduz no próprio aparelho (fotos de celular são grandes) e envia.
import { useRef, useState, useTransition } from "react";
import { enviarFotos } from "./fotos";

async function reduzir(arq: File): Promise<File> {
  const bmp = await createImageBitmap(arq, { imageOrientation: "from-image" }).catch(() => null);
  if (!bmp) return arq;
  const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob | null = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.82));
  return blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : arq;
}

export function EnviarFotos({ vagas }: { vagas: number }) {
  const [msg, setMsg] = useState("");
  const [ocupado, iniciar] = useTransition();
  const [lendo, setLendo] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const lista = Array.from(e.target.files ?? []).slice(0, Math.min(vagas, 5));
    if (!lista.length) return;
    setMsg(""); setLendo(true);
    const fd = new FormData();
    for (const a of lista) fd.append("fotos", await reduzir(a));
    setLendo(false);
    iniciar(async () => { setMsg(await enviarFotos(fd)); if (ref.current) ref.current.value = ""; });
  }

  const trabalhando = lendo || ocupado;
  return (
    <div>
      <label className={`btn${trabalhando || vagas <= 0 ? " pendente" : ""}`} style={{ cursor: trabalhando ? "progress" : "pointer" }}>
        {trabalhando && <span className="giro" aria-hidden="true" />}
        {trabalhando ? "Enviando…" : "Enviar fotos"}
        <input ref={ref} type="file" accept="image/*" multiple hidden disabled={trabalhando || vagas <= 0} onChange={aoEscolher} />
      </label>
      {vagas <= 0 && <small className="dica" style={{ marginLeft: 8 }}>Limite de fotos atingido.</small>}
      {msg && <p className="sub" role="status" style={{ margin: "8px 0 0" }}>{msg}</p>}
    </div>
  );
}
