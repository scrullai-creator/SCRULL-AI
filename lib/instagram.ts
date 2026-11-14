// API do Instagram com Login Unificado (Login do Facebook para Empresas + config_id).
// O cliente entra com o Instagram OU com o Facebook e não precisa de Página do Facebook.
// O app recebe um token de usuário do sistema do portfólio empresarial do cliente,
// que, na configuração atual do painel da Meta, não expira.
const GRAPH = "https://graph.facebook.com/v27.0";

export const redirectUri = () => `${process.env.APP_URL}/api/instagram/callback`;

// As permissões vêm da configuração (config_id) criada no painel da Meta, não de "scope".
export function urlDeAutorizacao(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    config_id: process.env.INSTAGRAM_CONFIG_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    prompt: "login", // sempre mostra as opções "Instagram" e "Facebook"
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${p}`;
}

// Lê a resposta da Meta sem nunca registrar tokens nos logs.
async function json(res: Response) {
  let j: any;
  try {
    j = await res.json();
  } catch {
    throw new Error(`Resposta inválida da Meta (${res.status})`);
  }
  if (!res.ok || j.error) {
    const msg = j.error?.message ?? `Erro ${res.status}`;
    console.error("Meta API erro:", res.status, j.error?.type ?? "", j.error?.code ?? "", msg);
    throw new Error(msg);
  }
  return j;
}

export async function trocarCodigo(code: string) {
  const p = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    redirect_uri: redirectUri(),
    code,
  });
  const j = await json(await fetch(`${GRAPH}/oauth/access_token?${p}`));
  if (!j.access_token) throw new Error("A Meta não devolveu o token");
  return {
    token: j.access_token as string,
    // Token de usuário do sistema normalmente vem sem prazo (não expira)
    expiraEm: j.expires_in ? new Date(Date.now() + Number(j.expires_in) * 1000) : null,
  };
}

export class SemContaInstagram extends Error {}

// Com esse tipo de token, /me é o usuário do sistema, não a conta do Instagram.
// As contas que o cliente compartilhou ficam em /me/assigned_instagram_accounts.
export async function perfil(token: string) {
  const p = new URLSearchParams({ fields: "id,username", access_token: token });
  const j = await json(await fetch(`${GRAPH}/me/assigned_instagram_accounts?${p}`));
  const conta = (j.data ?? [])[0];
  if (!conta?.id) throw new SemContaInstagram("Nenhuma conta do Instagram foi compartilhada");
  return { userId: String(conta.id), username: String(conta.username ?? "") };
}
