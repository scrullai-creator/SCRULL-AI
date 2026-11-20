"use server";
import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { registrar } from "@/lib/historico";

const ok = ["ativa", "teste", "cancelada"];

export async function mudarAssinatura(f: FormData) {
  await exigirAdmin();
  const id = String(f.get("id") ?? ""), status = String(f.get("status") ?? "");
  if (!id || !ok.includes(status)) return;
  await supabaseAdmin().from("clientes").update({ assinatura: status }).eq("id", id);
  revalidatePath("/admin");
}

export async function statusDoPost(f: FormData) {
  await exigirAdmin();
  const id = String(f.get("id") ?? ""), status = String(f.get("status") ?? "");
  const de = status === "aprovado" ? ["aguardando_aprovacao", "recusado", "erro"] : ["aguardando_aprovacao", "aprovado"];
  if (!id || !["aprovado", "recusado"].includes(status)) return;
  const { data } = await supabaseAdmin().from("posts").update({ status }).eq("id", id).in("status", de).select("id, cliente_id");
  if (data?.length) await registrar(id, data[0].cliente_id, status, null, "dono");
  revalidatePath("/admin", "layout");
}
