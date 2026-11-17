import type { Metadata } from "next";
import { entrarNaLista } from "./actions";

export const metadata: Metadata = {
  title: "Scrull AI — Avise-me quando abrir",
  description: "O Scrull AI cria, agenda e posta o Instagram do seu negócio. Deixe seu e-mail e avisamos quando abrirmos.",
};

const caixa = { width: "100%", padding: "0.8rem 0.9rem", borderRadius: 10, border: "1px solid #c9bdf5", fontSize: 16, boxSizing: "border-box" } as const;

export default async function Espera({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; o?: string }> }) {
  const q = await searchParams;
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "2rem 1.2rem 3rem", fontFamily: "system-ui, sans-serif", color: "#1d1535" }}>
      <img src="/mascote-pequeno.png" alt="Mascote do Scrull AI" width={72} height={72} />
      <h1 style={{ fontSize: "1.9rem", lineHeight: 1.2, margin: "0.6rem 0" }}>Seu Instagram postando sozinho.</h1>
      <p style={{ fontSize: "1.05rem", lineHeight: 1.5 }}>
        O Scrull AI cria os posts do seu negócio, agenda nos melhores horários e publica por você. Estamos abrindo aos poucos.
        Deixe seu e-mail e avisamos quando for a sua vez.
      </p>

      {q.ok ? (
        <p role="status" style={{ background: "#e9fbe9", border: "1px solid #9ad89a", padding: "1rem", borderRadius: 10 }}>
          Pronto! Você está na lista. Avisaremos por e-mail quando abrirmos.
        </p>
      ) : (
        <form action={entrarNaLista} style={{ display: "grid", gap: "0.7rem", marginTop: "1.2rem" }}>
          {q.erro && (
            <p role="alert" style={{ background: "#fff4d6", border: "1px solid #e8c766", padding: "0.8rem", borderRadius: 10, margin: 0 }}>
              {q.erro === "2" ? "Não consegui salvar agora. Tente de novo em instantes." : "Confira o e-mail e marque a autorização para continuar."}
            </p>
          )}
          <input style={caixa} type="email" name="email" placeholder="Seu melhor e-mail" required autoComplete="email" />
          <input style={caixa} type="text" name="negocio" placeholder="Nome do seu negócio (opcional)" />
          <input style={caixa} type="text" name="instagram" placeholder="@ do Instagram (opcional)" />
          <input type="hidden" name="origem" value={q.o ?? ""} />
          <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} />
          <label style={{ fontSize: "0.9rem", display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
            <input type="checkbox" name="aceite" style={{ marginTop: 4 }} />
            <span>Autorizo o Scrull AI a usar meu e-mail para me avisar sobre o lançamento. Veja a <a href="/privacidade">política de privacidade</a>.</span>
          </label>
          <button type="submit" style={{ padding: "0.9rem", borderRadius: 10, border: 0, background: "#6d3df2", color: "#fff", fontSize: 17, fontWeight: 700 }}>
            Quero ser avisado(a)
          </button>
        </form>
      )}
    </main>
  );
}
