"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseDoUsuario } from "@/lib/supabase";
import { decifrar } from "@/lib/crypto";
import { contasDoToken } from "@/lib/instagram";
import { salvarConexao, ContaDeOutroCliente, COOKIE_PENDENTE, type Pendente } from "@/lib/conexao";

export async function escolherInstagram(f: FormData) {
  const supabase = await supabaseDoUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const jar = await cookies();
  const bruto = jar.get(COOKIE_PENDENTE)?.value;
  let pendente: Pendente | null = null;
  try { pendente = bruto ? JSON.parse(decifrar(bruto)) : null; } catch { pendente = null; }
  if (!pendente || pendente.userId !== user.id || Date.now() - pendente.criadoEm > 600_000) redirect("/painel?ig=escolha-expirou");

  let resultado = "erro";
  try {
    // Confere que a conta escolhida é mesmo uma das compartilhadas neste login
    const escolhida = (await contasDoToken(pendente.token)).find((c) => c.userId === String(f.get("conta") ?? ""));
    if (!escolhida) throw new Error("conta escolhida não está entre as compartilhadas");
    await salvarConexao(user.id, pendente.token, pendente.expiraEm ? new Date(pendente.expiraEm) : null, escolhida);
    resultado = "ok";
  } catch (e) {
    if (e instanceof ContaDeOutroCliente) resultado = "conta-de-outro";
    else console.error("Erro ao escolher a conta do Instagram:", e);
  }
  jar.delete(COOKIE_PENDENTE);
  revalidatePath("/painel");
  redirect(`/painel?ig=${resultado}`);
}
