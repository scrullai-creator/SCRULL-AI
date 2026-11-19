// Página do Facebook: o mesmo post do Instagram sai também na Página do cliente.
// Usa a mesma conexão do Login Unificado. Precisa das permissões pages_show_list
// e pages_manage_posts na configuração (config_id) do painel da Meta.
// Tudo aqui é "extra": se falhar, o Instagram continua funcionando normalmente.
const GRAPH = "https://graph.facebook.com/v27.0";

async function meta(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || j.error) {
    const msg = j?.error?.error_user_msg ?? j?.error?.message ?? `Erro ${res.status}`;
    console.error("Facebook erro:", res.status, j?.error?.code ?? "", j?.error?.error_subcode ?? "", msg);
    throw new Error(msg);
  }
  return j;
}

export type PaginaFacebook = { id: string; nome: string; token: string };

// Procura a Página ligada ao Instagram conectado; se não achar, usa a primeira
// Página compartilhada. Sem permissão ou sem Página: devolve null, sem erro.
export async function paginaDoFacebook(token: string, igUserId: string): Promise<PaginaFacebook | null> {
  try {
    const p = new URLSearchParams({
      fields: "id,name,access_token,instagram_business_account{id}",
      limit: "50",
      access_token: token,
    });
    const j = await meta(`${GRAPH}/me/accounts?${p}`);
    const paginas: any[] = (j.data ?? []).filter((pg: any) => pg?.id && pg?.access_token);
    const escolhida = paginas.find((pg) => String(pg.instagram_business_account?.id ?? "") === igUserId) ?? paginas[0];
    if (!escolhida) return null;
    return { id: String(escolhida.id), nome: String(escolhida.name ?? ""), token: String(escolhida.access_token) };
  } catch {
    return null;
  }
}

// Publica a foto com a legenda na Página. Devolve o id do post no Facebook.
export async function publicarNaPagina(pageId: string, pageToken: string, imagemUrl: string, legenda: string) {
  const j = await meta(`${GRAPH}/${pageId}/photos`, {
    method: "POST",
    body: new URLSearchParams({ url: imagemUrl, message: legenda, published: "true", access_token: pageToken }),
  });
  return String(j.post_id ?? j.id);
}
