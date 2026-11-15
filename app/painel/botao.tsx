"use client";
// Botão de formulário que mostra que foi clicado: afunda ao tocar e, enquanto a ação roda, vira "aguarde" com um indicador girando.
import { useFormStatus } from "react-dom";

export function Botao(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const { className = "", children, ...resto } = props;
  return (
    <button {...resto} className={`${className}${pending ? " pendente" : ""}`} aria-busy={pending} disabled={pending || resto.disabled}>
      {pending && <span className="giro" aria-hidden="true" />}
      {children}
    </button>
  );
}
