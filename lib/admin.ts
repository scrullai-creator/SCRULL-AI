import { redirect } from "next/navigation";
import { supabaseDoUsuario } from "@/lib/supabase";

// Só quem tem o e-mail em ADMIN_EMAILS (separados por vírgula) entra na área do dono.
// A checagem é feita no servidor, em toda página e em toda ação.
export async function exigirAdmin() {
  const { data: { user } } = await (await supabaseDoUsuario()).auth.getUser();
  if (!user) redirect("/login");
  const lista = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((e) => e.trim()).filter(Boolean);
  if (!user.email || !lista.includes(user.email.toLowerCase())) redirect("/painel");
  return user;
}
