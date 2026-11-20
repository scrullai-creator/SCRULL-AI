"use client";
// "Publicar agora" pede confirmação antes: o primeiro toque só pergunta; o post só vai ao ar no "Sim, publicar".
// Enquanto publica, o botão fica travado (sem clique duplo) e o servidor ainda trava o post como "publicando".
import { useState } from "react";
import { Botao } from "./botao";

export function PublicarAgora(p: { id: string; vista: string; acao: (f: FormData) => Promise<void>; rotulo?: string; facebook?: boolean }) {
  const [perguntando, setPerguntando] = useState(false);
  if (!perguntando) {
    return (
      <button type="button" className="btn sm ig-agora" onClick={() => setPerguntando(true)}>
        {p.rotulo ?? "Publicar agora"}
      </button>
    );
  }
  return (
    <form action={p.acao} className="confirmar" role="group" aria-label="Confirmar publicação">
      <input type="hidden" name="id" value={p.id} />
      <input type="hidden" name="vista" value={p.vista} />
      <input type="hidden" name="confirmado" value="sim" />
      <span>Publicar agora no Instagram{p.facebook ? " e no Facebook" : ""}? Não dá para desfazer pelo app.</span>
      <Botao className="btn sm ig-agora">Sim, publicar</Botao>
      <button type="button" className="btn sm ghost" onClick={() => setPerguntando(false)}>Cancelar</button>
    </form>
  );
}
