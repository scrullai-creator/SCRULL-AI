"use client";
// Mantém a tela no mesmo lugar depois de uma ação (aprovar, trocar arte, reescrever legenda...).
// Antes de enviar um formulário, guarda onde a pessoa estava (o post e a distância dele até o topo da tela);
// quando o painel recarrega, devolve a tela para o mesmo ponto, mesmo que apareça um aviso lá em cima.
import { useEffect } from "react";

const CHAVE = "scrull-posicao";

export function ManterPosicao() {
  useEffect(() => {
    function guardar(e: Event) {
      try {
        const alvo = e.target as HTMLElement | null;
        const post = alvo?.closest?.("[id^='post-']") as HTMLElement | null;
        const dados = post
          ? { id: post.id, topo: post.getBoundingClientRect().top, y: window.scrollY }
          : { id: "", topo: 0, y: window.scrollY };
        sessionStorage.setItem(CHAVE, JSON.stringify(dados));
      } catch { /* sem sessionStorage: segue sem guardar */ }
    }
    document.addEventListener("submit", guardar, true);
    return () => document.removeEventListener("submit", guardar, true);
  }, []);

  // roda a cada vez que o painel é desenhado de novo (inclusive depois de uma ação do servidor)
  useEffect(() => {
    let bruto: string | null = null;
    try { bruto = sessionStorage.getItem(CHAVE); } catch { return; }
    if (!bruto) return;
    try { sessionStorage.removeItem(CHAVE); } catch { /* ignora */ }
    let d: { id: string; topo: number; y: number };
    try { d = JSON.parse(bruto); } catch { return; }
    const voltar = () => {
      const el = d.id ? document.getElementById(d.id) : null;
      if (el) window.scrollBy(0, el.getBoundingClientRect().top - d.topo);
      else window.scrollTo(0, d.y);
    };
    // duas passadas: o navegador (ou o Next) pode rolar até o #post sozinho logo depois
    const a = requestAnimationFrame(() => { voltar(); setTimeout(voltar, 120); });
    return () => cancelAnimationFrame(a);
  });

  return null;
}
