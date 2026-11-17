"use server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";

// Cadastro na lista de aviso do lançamento. Guarda só o que é preciso para avisar a pessoa.
export async function entrarNaLista(f: FormData) {
  const email = String(f.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const negocio = String(f.get("negocio") ?? "").trim().slice(0, 120);
  const instagram = String(f.get("instagram") ?? "").trim().replace(/^@/, "").slice(0, 60);
  const origem = String(f.get("origem") ?? "").trim().slice(0, 40);
  const aceite = f.get("aceite") === "on";
  if (String(f.get("site") ?? "") !== "") redirect("/espera?ok=1"); // campo-armadilha para robôs
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !aceite) redirect("/espera?erro=1");
  const { error } = await supabaseAdmin().from("lista_aviso").insert({
    email, nome_negocio: negocio || null, instagram: instagram || null, origem: origem || null,
  });
  // e-mail repetido não é erro para a pessoa: ela já está na lista
  if (error && error.code !== "23505") {
    console.error("Erro ao gravar na lista de aviso:", error.message);
    redirect("/espera?erro=2");
  }
  redirect("/espera?ok=1");
}
