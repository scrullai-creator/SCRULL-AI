// Liga UMA conta do Instagram a um cliente do Scrull.
// Regras: cada cliente publica só na conta que ele escolheu; ao trocar de conta, a antiga é desligada
// e os posts ainda não publicados passam para a nova; e uma conta já ligada a outro cliente não pode ser ligada de novo
// (foi assim que posts de um perfil acabaram saindo no Instagram de outro).
import { supabaseAdmin } from "./supabase";
import { cifrar } from "./crypto";
import { paginaDoFacebook } from "./facebook";

export class ContaDeOutroCliente extends Error {}

// Escolha pendente (quando o login compartilha mais de uma conta): fica num cookie cifrado por 10 minutos
export const COOKIE_PENDENTE = "ig_pendente";
export type Pendente = { userId: string; token: string; expiraEm: string | null; criadoEm: number };

export async function salvarConexao(clienteId: string, token: string, expiraEm: Date | null, conta: { userId: string; username: string }) {
  const db = supabaseAdmin();

  const { data: deOutro } = await db.from("contas_instagram").select("cliente_id")
    .eq("ig_user_id", conta.userId).eq("ativa", true).neq("cliente_id", clienteId).limit(1);
  if (deOutro?.length) throw new ContaDeOutroCliente(`@${conta.username} já está ligada a outro perfil do Scrull`);

  const { data: salva, error } = await db.from("contas_instagram")
    .upsert({ cliente_id: clienteId, ig_user_id: conta.userId, ig_username: conta.username, ativa: true }, { onConflict: "cliente_id,ig_user_id" })
    .select("id").single();
  if (error) throw error;

  const { error: erroToken } = await db.from("tokens_instagram").upsert({
    conta_id: salva.id,
    token_cifrado: cifrar(token),
    // token de usuário do sistema não expira: guarda uma data bem distante
    expira_em: (expiraEm ?? new Date("2099-12-31T00:00:00Z")).toISOString(),
    atualizado_em: new Date().toISOString(),
  });
  if (erroToken) throw erroToken;

  // Só uma conta ativa por cliente; posts que ainda não saíram vão para a conta nova
  await db.from("contas_instagram").update({ ativa: false }).eq("cliente_id", clienteId).neq("id", salva.id);
  const { error: erroPosts } = await db.from("posts").update({ conta_id: salva.id })
    .eq("cliente_id", clienteId).neq("status", "publicado").neq("status", "publicando");
  if (erroPosts) console.error("Não foi possível mover os posts para a conta nova:", erroPosts.message);

  // Extra: Página do Facebook ligada ao Instagram. Se não houver ou der erro, o Instagram continua conectado.
  const pagina = await paginaDoFacebook(token, conta.userId);
  if (pagina) {
    const [r1, r2] = await Promise.all([
      db.from("contas_instagram").update({ fb_page_id: pagina.id, fb_page_nome: pagina.nome }).eq("id", salva.id),
      db.from("tokens_instagram").update({ fb_page_token_cifrado: cifrar(pagina.token) }).eq("conta_id", salva.id),
    ]);
    if (r1.error || r2.error) console.error("Página do Facebook não foi salva:", r1.error?.message ?? r2.error?.message);
  } else {
    await db.from("contas_instagram").update({ fb_page_id: null, fb_page_nome: null }).eq("id", salva.id);
  }
}
