// Quando o login da Meta compartilha mais de uma conta do Instagram, o cliente escolhe aqui
// qual conta é a deste perfil do Scrull. Nada é ligado sem essa escolha.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseDoUsuario } from "@/lib/supabase";
import { decifrar } from "@/lib/crypto";
import { contasDoToken } from "@/lib/instagram";
import { COOKIE_PENDENTE, type Pendente } from "@/lib/conexao";
import { escolherInstagram } from "./actions";
import { Botao } from "../botao";

export const dynamic = "force-dynamic";

export default async function EscolherInstagram() {
  const supabase = await supabaseDoUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const bruto = (await cookies()).get(COOKIE_PENDENTE)?.value;
  let pendente: Pendente | null = null;
  try { pendente = bruto ? JSON.parse(decifrar(bruto)) : null; } catch { pendente = null; }
  if (!pendente || pendente.userId !== user.id || Date.now() - pendente.criadoEm > 600_000) redirect("/painel?ig=escolha-expirou");

  const [contas, { data: cliente }] = await Promise.all([
    contasDoToken(pendente.token).catch(() => []),
    supabase.from("clientes").select("nome_empresa").eq("id", user.id).single(),
  ]);
  if (!contas.length) redirect("/painel?ig=sem-conta");

  return (
    <div className="centro">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Qual é o Instagram de {cliente?.nome_empresa || "este negócio"}?</h2>
        <p className="sub">
          O seu login tem acesso a mais de uma conta. Escolha a conta onde a Scrull deve publicar os posts deste perfil.
          As outras contas não são usadas.
        </p>
        {contas.map((c) => (
          <form key={c.userId} action={escolherInstagram} style={{ marginTop: 10 }}>
            <input type="hidden" name="conta" value={c.userId} />
            <Botao className="btn ig">@{c.username || c.userId}</Botao>
          </form>
        ))}
        <p style={{ marginTop: 16 }}><a href="/painel">Cancelar</a></p>
      </div>
    </div>
  );
}
