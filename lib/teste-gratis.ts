// Teste grátis: quem ainda não assinou ganha DIAS_GRATIS posts publicados de verdade no próprio Instagram
// (um por dia). Para controlar o custo, o teste vale UMA vez por conta do Instagram: criar outro e-mail
// com o mesmo Instagram não dá direito a outro teste (contamos os posts que já saíram por essa conta, em qualquer cadastro).
import { supabaseAdmin } from "./supabase";

export const DIAS_GRATIS = Number(process.env.DIAS_GRATIS ?? 3);

export class TesteEncerrado extends Error {}

// Quantos posts já foram publicados pela Scrull nesta conta do Instagram (somando todos os cadastros)
export async function publicadosNoInstagram(contaId: string): Promise<number> {
  const db = supabaseAdmin();
  const { data: conta } = await db.from("contas_instagram").select("ig_user_id").eq("id", contaId).single();
  if (!conta?.ig_user_id) return 0;
  const { data: contas } = await db.from("contas_instagram").select("id").eq("ig_user_id", conta.ig_user_id);
  const ids = (contas ?? []).map((c) => c.id);
  if (!ids.length) return 0;
  const { count } = await db.from("posts").select("id", { count: "exact", head: true })
    .in("conta_id", ids).in("status", ["publicado", "publicando"]);
  return count ?? 0;
}

// Situação do teste de um cliente que ainda não assinou
export async function situacaoDoTeste(clienteId: string): Promise<{ emTeste: boolean; restam: number }> {
  const db = supabaseAdmin();
  const { data: c } = await db.from("clientes").select("assinatura").eq("id", clienteId).single();
  if (c?.assinatura !== "teste") return { emTeste: false, restam: 0 };
  const { data: conta } = await db.from("contas_instagram").select("id")
    .eq("cliente_id", clienteId).eq("ativa", true).limit(1).maybeSingle();
  if (!conta) return { emTeste: true, restam: DIAS_GRATIS };
  return { emTeste: true, restam: Math.max(0, DIAS_GRATIS - (await publicadosNoInstagram(conta.id))) };
}
