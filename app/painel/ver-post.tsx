"use client";
// Miniatura da arte: ao clicar, abre o post em tamanho grande, como vai aparecer no Instagram,
// com a legenda e os botões para aprovar ali mesmo.
import { useEffect, useRef, useState } from "react";

export function VerPost(p: {
  imagem: string; titulo: string; legenda: string; hashtags: string[]; perfil?: string; quando: string;
  children?: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const fechar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", tecla);
    document.body.style.overflow = "hidden";
    fechar.current?.focus();
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <>
      <button type="button" className="arte-btn" onClick={() => setAberto(true)} aria-label={`Ver o post "${p.titulo}" em tamanho grande`}>
        <img src={p.imagem} alt={p.titulo} />
        <span className="lupa" aria-hidden="true">Ampliar</span>
      </button>
      {aberto && (
        <div className="vp-fundo" onClick={() => setAberto(false)}>
          <div className="vp" role="dialog" aria-modal="true" aria-label={`Prévia do post: ${p.titulo}`} onClick={(e) => e.stopPropagation()}>
            <div className="vp-topo">
              <span><b>@{p.perfil ?? "seu_perfil"}</b><small>{p.quando}</small></span>
              <button ref={fechar} type="button" className="vp-x" onClick={() => setAberto(false)} aria-label="Fechar">×</button>
            </div>
            <img className="vp-img" src={p.imagem} alt={p.titulo} />
            <div className="vp-texto">
              <p className="legenda"><b>{p.perfil ?? "seu_perfil"}</b> {p.legenda}</p>
              {!!p.hashtags.length && <p className="tags">{p.hashtags.join(" ")}</p>}
            </div>
            {p.children && <div className="vp-acoes acoes">{p.children}</div>}
          </div>
        </div>
      )}
    </>
  );
}
