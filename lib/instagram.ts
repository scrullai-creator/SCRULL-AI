// Instagram API with Instagram Login (Business Login for Instagram).
// O cliente entra direto pelo Instagram: não precisa de Página do Facebook.
// Usa o ID e a chave secreta do app do INSTAGRAM (painel Meta > Instagram >
// "Configuração da API com login do Instagram"), que são diferentes dos do app da Meta.
const AUTORIZAR = "https://www.instagram.com/oauth/authorize";
const TROCA = "https://api.instagram.com/oauth/access_token";
const GRAPH = "https://graph.instagram.com";

const ESCOPOS = "instagram_business_basic,instagram_business_content_publish";
const SESSENTA_DIAS = 5184000;

export const redirectUri = () => `${process.env.APP_URL}/api/instagram/callback`;

export function urlDeAutorizacao(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: ESCOPOS,
    state,
  });
  return `${AUTORIZAR}?${p}`;
}

// Lê a resposta da Meta sem nunca registrar tokens nos logs.
async function json(res: Response) {
  let j: any;
  try {
    j = await res.json();
  } catch {
    throw new Error(`Resposta inválida do Instagram (${res.status})`);
  }
  if (!res.ok || j.error || j.error_message) {
    const msg = j.error?.message ?? j.error_message ?? `Erro ${res.status}`;
    console.error("Instagram API erro:", res.status, j.error?.type ?? j.error_type ?? "", msg);
    throw new Error(msg);
  }
  return j;
}

export async function trocarCodigo(code: string) {
  const body = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
  });
  const j = await json(await fetch(TROCA, { method: "POST", body }));
  // A resposta pode vir direta ou dentro de "data": [ { ... } ]
  const d = Array.isArray(j.data) ? j.data[0] : j;
  if (!d?.access_token) throw new Error("O Instagram não devolveu o token");
  return { token: d.access_token as string, userId: String(d.user_id ?? "") };
}

export async function tokenLongo(tokenCurto: string) {
  const p = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: process.env.INSTAGRAM_APP_SECRET!,
    access_token: tokenCurto,
  });
  const j = await json(await fetch(`${GRAPH}/access_token?${p}`));
  return {
    token: j.access_token as string,
    expiraEm: new Date(Date.now() + Number(j.expires_in ?? SESSENTA_DIAS) * 1000),
  };
}

// Renova um token longo por mais 60 dias (o token precisa ter pelo menos 24h e ainda estar válido).
export async function renovarToken(token: string) {
  const p = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token });
  const j = await json(await fetch(`${GRAPH}/refresh_access_token?${p}`));
  return {
    token: j.access_token as string,
    expiraEm: new Date(Date.now() + Number(j.expires_in ?? SESSENTA_DIAS) * 1000),
  };
}

export async function perfil(token: string) {
  const p = new URLSearchParams({ fields: "user_id,username,account_type", access_token: token });
  const ig = await json(await fetch(`${GRAPH}/me?${p}`));
  // user_id é o ID da conta profissional, usado depois para publicar
  const userId = ig.user_id ?? ig.id;
  if (!userId) throw new Error("Conta do Instagram não encontrada");
  return {
    userId: String(userId),
    username: String(ig.username ?? ""),
    tipo: String(ig.account_type ?? "BUSINESS"),
  };
}
