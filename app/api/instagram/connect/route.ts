import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseDoUsuario, supabaseAdmin } from "@/lib/supabase";
import { urlDeAutorizacao } from "@/lib/instagram";

export async function GET() {
  const supabase = await supabaseDoUsuario();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${process.env.APP_URL}/login`);

  const state = randomBytes(24).toString("hex");
  const db = supabaseAdmin();
  await db.from("oauth_states").upsert(
    { user_id: user.id, state, expires_at: new Date(Date.now() + 600_000).toISOString() },
    { onConflict: "user_id" }
  );

  return NextResponse.redirect(urlDeAutorizacao(state));
}
