const GRAPH = "https://graph.facebook.com";

export const redirectUri = () => `${process.env.APP_URL}/api/instagram/callback`;

export function urlDeAutorizacao(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    config_id: process.env.INSTAGRAM_CONFIG_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${p}`;
}

async function json(res: Response) {
  const j = await res.json();
  if (!res.ok || j.error || j.error_message) {
    console.error("Meta API erro completo:", JSON.stringify(j));
    throw new Error(j.error?.message ?? j.error_message ?? `Erro ${res.status}`);
  }
  return j;
}

export async function trocarCodigo(code: string) {
  const body = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
  });
  const res = await fetch(`${GRAPH}/oauth/access_token`, { method: "POST", body });
  const texto = await res.text();
  console.log("trocarCodigo → status:", res.status, "resposta:", texto.slice(0, 200));
  const j = JSON.parse(texto);
  if (!res.ok || j.error || j.error_message) {
    throw new Error(j.error?.message ?? j.error_message ?? `Erro ${res.status}`);
  }
  return { token: j.access_token as string, userId: String(j.user_id ?? "") };
}

export async function tokenLongo(tokenCurto: string) {
  const p = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: tokenCurto,
  });
  const j = await json(await fetch(`${GRAPH}/oauth/access_token?${p}`));
  console.log("tokenLongo → ok, expires_in:", j.expires_in);
  return {
    token: j.access_token as string,
    expiraEm: new Date(Date.now() + Number(j.expires_in ?? 5184000) * 1000),
  };
}

export async function renovarToken(token: string) {
  const p = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: token,
  });
  const j = await json(await fetch(`${GRAPH}/oauth/access_token?${p}`));
  return {
    token: j.access_token as string,
    expiraEm: new Date(Date.now() + Number(j.expires_in ?? 5184000) * 1000),
  };
}

export async function perfil(token: string) {
  // 1) Login Unificado: busca instagram_business_account via /me
  const meRes = await fetch(
    `${GRAPH}/me?fields=id,name,instagram_business_account{id,username,account_type}&access_token=${token}`
  );
  const me = await meRes.json();
  console.log("perfil 1/me:", JSON.stringify(me).slice(0, 300));
  if (me.instagram_business_account) {
    const iga = me.instagram_business_account;
    return { userId: String(iga.id), username: iga.username as string, tipo: String(iga.account_type ?? "BUSINESS") };
  }

  // 2) Via páginas vinculadas
  const pagesRes = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,instagram_business_account{id,username,account_type}&access_token=${token}`
  );
  const pages = await pagesRes.json();
  console.log("perfil 2/accounts:", JSON.stringify(pages).slice(0, 400));
  const pageWithIG = (pages.data ?? []).find((p: any) => p.instagram_business_account);
  if (pageWithIG) {
    const iga = pageWithIG.instagram_business_account;
    return { userId: String(iga.id), username: iga.username as string, tipo: String(iga.account_type ?? "BUSINESS") };
  }

  // 3) Login Unificado via owned_instagram_accounts (token de sistema)
  const ownedRes = await fetch(
    `${GRAPH}/me/owned_instagram_accounts?fields=id,username,account_type&access_token=${token}`
  );
  const owned = await ownedRes.json();
  console.log("perfil 3/owned_instagram_accounts:", JSON.stringify(owned).slice(0, 400));
  if (owned.data && owned.data.length > 0) {
    const ig = owned.data[0];
    return { userId: String(ig.id), username: ig.username as string, tipo: String(ig.account_type ?? "BUSINESS") };
  }

  // 4) Tenta via Instagram Graph API diretamente (fallback)
  const igRes = await fetch(
    `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${token}`
  );
  const ig = await igRes.json();
  console.log("perfil 4/instagram.com/me:", JSON.stringify(ig).slice(0, 300));
  if (ig.id) {
    console.log("perfil: aceitando conta IG:", ig.account_type);
    return { userId: String(ig.id), username: ig.username as string, tipo: String(ig.account_type ?? "BUSINESS") };
  }

  console.error("perfil sem IG. me:", JSON.stringify(me).slice(0, 150));
  return { userId: String(me.id ?? "unknown"), username: String(me.name ?? "unknown"), tipo: "PERSONAL" };
}
