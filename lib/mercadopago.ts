// Assinatura mensal pelo Mercado Pago (API de assinaturas, "preapproval" sem plano associado).
// O cliente é levado ao checkout do Mercado Pago; quando ele autoriza, a assinatura fica
// "authorized" e o Scrull ativa a conta. Os dados do cartão nunca passam pelo Scrull.
import { supabaseAdmin } from "./supabase";

const API = "https://api.mercadopago.com";

export const pagamentoConfigurado = () => !!process.env.MP_ACCESS_TOKEN;

async function mp(caminho: string, init?: RequestInit) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN não configurado");
  const res = await fetch(`${API}${caminho}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j) {
    console.error("Mercado Pago erro:", res.status, caminho, JSON.stringify(j ?? {}).slice(0, 900));
    throw new Error(j?.message ?? `Mercado Pago respondeu com erro ${res.status}`);
  }
  return j;
}

// Cria a assinatura e devolve o link do checkout do Mercado Pago
export async function criarAssinatura(a: { clienteId: string; email: string; planoId: string }) {
  const db = supabaseAdmin();
  const { data: plano } = await db.from("planos")
    .select("id, nome, preco_centavos, ativo").eq("id", a.planoId).single();
  if (!plano?.ativo) throw new Error("Plano indisponível");

  const j = await mp("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: `Scrull AI — plano ${plano.nome}`,
      external_reference: `${a.clienteId}|${plano.id}`,
      payer_email: a.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plano.preco_centavos / 100,
        currency_id: "BRL",
      },
      back_url: `${process.env.APP_URL}/api/mercadopago/retorno`,
      status: "pending",
    }),
  });
  if (!j.init_point) throw new Error("O Mercado Pago não devolveu o link de pagamento");
  await db.from("clientes").update({ mp_assinatura_id: String(j.id) }).eq("id", a.clienteId);
  return j.init_point as string;
}

// Consulta a assinatura no Mercado Pago (a fonte da verdade) e atualiza o cliente.
// Usada na volta do checkout e no aviso (webhook): nunca confia só no que chegou na URL.
export async function sincronizarAssinatura(preapprovalId: string) {
  const j = await mp(`/preapproval/${encodeURIComponent(preapprovalId)}`);
  const [clienteId, planoId] = String(j.external_reference ?? "").split("|");
  if (!clienteId) return null;

  const db = supabaseAdmin();
  const { data: cliente } = await db.from("clientes").select("id, mp_assinatura_id, assinatura").eq("id", clienteId).single();
  if (!cliente) return null;

  const situacao =
    j.status === "authorized" ? "ativa" :
    j.status === "paused" ? "atrasada" :
    j.status === "cancelled" ? "cancelada" : null;

  // Uma assinatura antiga cancelada não derruba a assinatura atual do cliente
  const ehAtual = !cliente.mp_assinatura_id || cliente.mp_assinatura_id === String(j.id);
  if (situacao === "ativa") {
    await db.from("clientes").update({ assinatura: "ativa", mp_assinatura_id: String(j.id), ...(planoId && { plano_id: planoId }) }).eq("id", clienteId);
  } else if (situacao && ehAtual) {
    await db.from("clientes").update({ assinatura: situacao }).eq("id", clienteId);
  }
  return { clienteId, status: String(j.status), situacao };
}

export async function cancelarAssinatura(clienteId: string) {
  const db = supabaseAdmin();
  const { data: c } = await db.from("clientes").select("mp_assinatura_id").eq("id", clienteId).single();
  if (c?.mp_assinatura_id) {
    await mp(`/preapproval/${encodeURIComponent(c.mp_assinatura_id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  }
  await db.from("clientes").update({ assinatura: "cancelada" }).eq("id", clienteId);
}
