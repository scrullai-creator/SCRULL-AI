// O Mercado Pago manda o cliente de volta para cá depois do checkout.
import { NextRequest, NextResponse } from "next/server";
import { sincronizarAssinatura } from "@/lib/mercadopago";

export async function GET(req: NextRequest) {
  const base = process.env.APP_URL!;
  const id = req.nextUrl.searchParams.get("preapproval_id");
  let resultado = "assin-pendente";
  try {
    if (id) {
      const r = await sincronizarAssinatura(id);
      if (r?.situacao === "ativa") resultado = "assin-ok";
    }
  } catch (e) {
    console.error("Retorno do Mercado Pago:", e);
  }
  return NextResponse.redirect(`${base}/painel?ig=${resultado}`);
}
