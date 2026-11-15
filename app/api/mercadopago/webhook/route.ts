// Avisos do Mercado Pago (assinatura autorizada, pausada, cancelada).
// O aviso traz só o id; o estado real é sempre consultado na API do Mercado Pago.
import { NextRequest, NextResponse } from "next/server";
import { sincronizarAssinatura } from "@/lib/mercadopago";

export async function POST(req: NextRequest) {
  const corpo = await req.json().catch(() => ({} as any));
  const q = req.nextUrl.searchParams;
  const tipo = corpo?.type ?? q.get("type") ?? q.get("topic");
  const id = corpo?.data?.id ?? q.get("data.id") ?? q.get("id");
  try {
    if (id && (tipo === "subscription_preapproval" || tipo === "preapproval")) {
      await sincronizarAssinatura(String(id));
    }
  } catch (e) {
    console.error("Webhook do Mercado Pago:", e);
    return NextResponse.json({ ok: false }, { status: 500 }); // o Mercado Pago tenta de novo
  }
  return NextResponse.json({ ok: true });
}
