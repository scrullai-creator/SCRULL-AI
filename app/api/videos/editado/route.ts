// O Submagic chama este endereço quando termina de editar um vídeo.
// O link leva o id do vídeo e uma assinatura (?v=...&t=...) que só o Scrull sabe gerar,
// e o id do projeto precisa bater com o que guardamos: ninguém de fora consegue trocar o vídeo.
import { NextRequest, NextResponse } from "next/server";
import { assinaturaValida, receberEdicao } from "@/lib/videos";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const v = req.nextUrl.searchParams.get("v") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!v || !assinaturaValida(v, t)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });

  const corpo = await req.json().catch(() => null);
  if (!corpo?.projectId) return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });

  const ok = await receberEdicao(v, String(corpo.projectId), String(corpo.status ?? ""), corpo.directUrl ?? corpo.downloadUrl ?? null);
  return NextResponse.json({ ok });
}
