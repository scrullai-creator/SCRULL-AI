import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseDoUsuario } from "@/lib/supabase";
import { sair } from "../painel/actions";
import { Botao } from "../painel/botao";

// Mostrado quando alguém sem permissão tenta abrir /admin: diz com qual e-mail está logado e deixa trocar de conta.
export default async function AcessoDono() {
  const { data: { user } } = await (await supabaseDoUsuario()).auth.getUser();
  if (!user) redirect("/login");
  return (
    <main style={{ maxWidth: 460, textAlign: "center", paddingTop: 48 }}>
      <img src="/mascote.png" alt="" width={96} height={96} style={{ borderRadius: 24 }} />
      <h1>Área do dono</h1>
      <p className="sub">Você está conectada como <b>{user.email}</b>, que não tem acesso a esta área.</p>
      <p className="sub">Saia e entre com o e-mail da dona do Scrull AI para abrir a administração.</p>
      <form action={sair}><Botao className="btn">Sair e trocar de conta</Botao></form>
      <p style={{ marginTop: 16 }}><Link href="/painel">Voltar ao meu painel</Link></p>
    </main>
  );
}
