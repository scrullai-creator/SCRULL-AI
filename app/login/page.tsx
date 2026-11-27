"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase-browser";
import { Cena } from "./cena";
import { createClient } from "@supabase/supabase-js";

export default function Login() {
  const router = useRouter();
  const [aba, setAba] = useState<"login" | "cadastro" | "esqueci">("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  // /login?aba=cadastro abre direto em "Criar conta" (link da página de vendas)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("aba") === "cadastro") setAba("cadastro");
    if (q.get("erro") === "link") setErro("Esse link expirou ou foi aberto em outro aparelho. Peça um novo em \"Esqueci minha senha\".");
    if (q.get("ok") === "senha") setMsg("Senha alterada! Já pode entrar com a senha nova.");
  }, []);

  // Esqueci minha senha: manda um link por e-mail que abre a tela de criar senha nova
  async function recuperar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setMsg(""); setCarregando(true);
    try {
      // Link que funciona em qualquer aparelho e navegador (não depende de onde o pedido foi feito):
      // ele leva direto para /nova-senha, que lê a sessão que vem no próprio link
      const avulso = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { error } = await avulso.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/nova-senha` });
      if (error && /rate|limit|seconds/i.test(error.message)) return setErro("Muitos pedidos seguidos. Espere um minuto e tente de novo.");
      // Mesmo se o e-mail não tiver conta, a resposta é a mesma (não revela quem é cliente)
      setMsg("Se esse e-mail tiver conta no Scrull, chega em instantes um link para criar uma senha nova. Pode abrir em qualquer aparelho. Confira também a caixa de spam.");
    } finally { setCarregando(false); }
  }

  // Depois de entrar, volta para onde a pessoa queria ir (ex.: /admin). Só aceita caminhos do próprio site.
  function destino() {
    const p = new URLSearchParams(window.location.search).get("proximo") ?? "";
    return /^\/[a-z0-9\-_/]*$/i.test(p) && !p.startsWith("//") ? p : "/painel";
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setMsg(""); setCarregando(true);
    try {
      const { error } = await supabaseNavegador().auth.signInWithPassword({ email, password: senha });
      if (error) return setErro("E-mail ou senha incorretos. Tente novamente.");
      router.push(destino());
      router.refresh();
    } finally { setCarregando(false); }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setMsg(""); setCarregando(true);
    try {
      if (!nome.trim()) return setErro("Informe o nome do seu negócio.");
      if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
      const { data, error } = await supabaseNavegador().auth.signUp({
        email, password: senha, options: { data: { nome_empresa: nome.trim() } },
      });
      if (error) {
        const m = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
        if (m.includes("already") || m.includes("exists")) return setErro("Esse e-mail já tem conta. Use a aba Entrar, ou cadastre com outro e-mail.");
        if (m.includes("rate") || m.includes("limit") || m.includes("seconds")) return setErro("Muitas tentativas seguidas. Espere um minuto e tente de novo.");
        if (m.includes("password") || m.includes("weak")) return setErro("Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.");
        if (m.includes("email") && m.includes("invalid")) return setErro("Esse e-mail não parece válido. Confira se digitou certo.");
        return setErro(`Não foi possível criar a conta: ${error.message}`);
      }
      if (!data.session) return setMsg("Quase lá! Verifique seu e-mail para confirmar a conta.");
      router.push("/painel");
      router.refresh();
    } finally { setCarregando(false); }
  }  const trocar = (a: typeof aba) => { setAba(a); setErro(""); setMsg(""); };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .sl-root{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px 16px;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden;color:#24124d;background:#140a33}
        .sl-fundo{position:fixed;inset:0;width:100%;height:100%;z-index:0}
        .estrela{animation:brilho 4s ease-in-out infinite}
        @keyframes brilho{50%{opacity:.15}}
        .cadente{stroke-dasharray:120;stroke-dashoffset:120;animation:cadente 7s ease-in 2s infinite}
        @keyframes cadente{0%{stroke-dashoffset:120;opacity:0}4%{opacity:.9}10%{stroke-dashoffset:-120;opacity:0}100%{stroke-dashoffset:-120;opacity:0}}
        .sl-card{position:relative;z-index:1;width:100%;max-width:410px;background:#fff;border-radius:26px;overflow:hidden;box-shadow:0 30px 80px rgba(20,8,60,.55),0 0 0 1px rgba(255,255,255,.15)}
        .sl-topo{position:relative;height:190px;display:flex;align-items:flex-end;justify-content:center}
        .sl-topo svg{position:absolute;inset:0;width:100%;height:100%}
        .sl-mascote{position:relative;z-index:2;width:148px;height:auto;margin-bottom:-38px;filter:drop-shadow(0 10px 16px rgba(36,10,90,.45)) drop-shadow(0 0 18px rgba(217,70,239,.35));animation:flut 4s ease-in-out infinite}
        @keyframes flut{50%{transform:translateY(-5px)}}
        .sl-corpo{padding:60px 32px 26px;display:flex;flex-direction:column;gap:18px}
        .sl-brand{text-align:center}
        .sl-name{font-family:'Syne',system-ui,sans-serif;font-size:25px;font-weight:800;letter-spacing:-.4px;line-height:1;color:#24124d}
        .sl-name span{color:#7c3aed}
        .sl-tag{font-size:13.5px;color:#7a6b9e;margin-top:6px}
        .sl-tabs{display:grid;grid-template-columns:1fr 1fr;background:#f3eefc;border-radius:12px;padding:4px;gap:4px}
        .sl-tab{background:transparent;border:none;color:#7a6b9e;font:600 14px 'Inter',system-ui,sans-serif;padding:10px;border-radius:9px;cursor:pointer;transition:all .2s ease}
        .sl-tab.ativo{background:#fff;color:#5b21b6;box-shadow:0 2px 10px rgba(91,33,182,.15)}
        .sl-fields{display:flex;flex-direction:column;gap:14px}
        .sl-field{display:flex;flex-direction:column;gap:6px}
        .sl-field label{font-size:13px;font-weight:600;color:#4b3a78}
        .sl-field input{background:#faf8ff;border:1.5px solid #e4dcf7;border-radius:12px;color:#24124d;font:500 15px 'Inter',system-ui,sans-serif;padding:13px 15px;outline:none;transition:border-color .2s,box-shadow .2s,background .2s;width:100%}
        .sl-field input::placeholder{color:#a99cc8}
        .sl-field input:focus{border-color:#8b5cf6;background:#fff;box-shadow:0 0 0 4px rgba(139,92,246,.16)}
        .sl-senha{position:relative}.sl-senha input{padding-right:84px}
        .sl-olho{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:#efe7ff;border:0;border-radius:8px;color:#6d28d9;font:600 12.5px 'Inter',system-ui,sans-serif;padding:7px 10px;cursor:pointer}
        .sl-olho:hover{background:#e2d4ff}
        .sl-linha{display:flex;justify-content:flex-end;margin-top:-4px}
        .sl-link{background:none;border:0;color:#6d28d9;font:600 13px 'Inter',system-ui,sans-serif;cursor:pointer;padding:2px 0;text-decoration:underline;text-underline-offset:3px}
        .sl-link:hover{color:#4c1d95}
        .sl-erro{background:#fff1f3;border:1px solid #fecdd6;border-radius:10px;color:#be123c;font-size:13.5px;padding:11px 14px}
        .sl-ok{background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;color:#047857;font-size:13.5px;padding:11px 14px}
        .sl-btn{background:linear-gradient(135deg,#7c3aed 0%,#a855f7 55%,#d946ef 100%);border:none;border-radius:12px;color:#fff;cursor:pointer;font:700 15px 'Inter',system-ui,sans-serif;padding:15px;width:100%;transition:transform .15s ease,box-shadow .15s ease;box-shadow:0 8px 22px rgba(124,58,237,.35)}
        .sl-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 10px 28px rgba(124,58,237,.45)}
        .sl-btn:active:not(:disabled),.sl-tab:active{transform:scale(.97)}
        .sl-btn:disabled{opacity:.65;cursor:default}
        .sl-btn:disabled::before{content:'';display:inline-block;width:14px;height:14px;margin-right:8px;vertical-align:-2px;border:2px solid rgba(255,255,255,.45);border-top-color:#fff;border-radius:50%;animation:giro .7s linear infinite}
        @keyframes giro{to{transform:rotate(360deg)}}
        .sl-voltar{text-align:center}
        .sl-sub{font-size:14px;color:#5b4b85;line-height:1.5}
        .sl-trust{display:flex;align-items:center;justify-content:center;gap:18px;padding-top:14px;border-top:1px solid #efe9fb}
        .sl-trust-item{display:flex;align-items:center;gap:6px;font-size:12px;color:#7a6b9e}
        .sl-dot{width:6px;height:6px;border-radius:50%;background:#a855f7}
        button:focus-visible,input:focus-visible{outline:3px solid #ffd21f;outline-offset:2px}
        @media(max-width:460px){.sl-corpo{padding:56px 22px 22px}.sl-topo{height:160px}.sl-trust{gap:12px}}
        @media(prefers-reduced-motion:reduce){.estrela,.cadente,.sl-mascote{animation:none}}
      `}</style>
      <div className="sl-root">
        <Cena id="fundo" className="sl-fundo" />
        <div className="sl-card">
          <div className="sl-topo">
            <Cena id="topo" />
            <img className="sl-mascote" src="/mascote-solto.png" alt="Mascote do Scrull AI" width={148} height={160} />
          </div>
          <div className="sl-corpo">
            <div className="sl-brand">
              <div className="sl-name">SCRULL <span>AI</span></div>
              <div className="sl-tag">Seu Instagram no automático!</div>
            </div>

            {aba !== "esqueci" && (
              <div className="sl-tabs" role="tablist">
                <button role="tab" aria-selected={aba === "login"} className={`sl-tab${aba === "login" ? " ativo" : ""}`} onClick={() => trocar("login")}>Entrar</button>
                <button role="tab" aria-selected={aba === "cadastro"} className={`sl-tab${aba === "cadastro" ? " ativo" : ""}`} onClick={() => trocar("cadastro")}>Criar conta</button>
              </div>
            )}
            {erro && <div className="sl-erro" role="alert">{erro}</div>}
            {msg && <div className="sl-ok" role="status">{msg}</div>}

            {aba === "login" && (
              <form className="sl-fields" onSubmit={entrar}>
                <div className="sl-field">
                  <label htmlFor="l-email">E-mail</label>
                  <input id="l-email" type="email" placeholder="voce@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="sl-field">
                  <label htmlFor="l-senha">Senha</label>
                  <div className="sl-senha"><input id="l-senha" type={ver ? "text" : "password"} placeholder="Sua senha" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password" /><button type="button" className="sl-olho" onClick={() => setVer(v => !v)} aria-pressed={ver}>{ver ? "Ocultar" : "Mostrar"}</button></div>
                </div>
                <div className="sl-linha"><button type="button" className="sl-link" onClick={() => trocar("esqueci")}>Esqueci minha senha</button></div>
                <button type="submit" className="sl-btn" disabled={carregando}>{carregando ? "Entrando…" : "Entrar"}</button>
              </form>
            )}

            {aba === "cadastro" && (
              <form className="sl-fields" onSubmit={cadastrar}>
                <div className="sl-field">
                  <label htmlFor="c-nome">Nome do negócio</label>
                  <input id="c-nome" type="text" placeholder="Ex.: Doceria da Ana" value={nome} onChange={e => setNome(e.target.value)} required autoComplete="organization" />
                </div>
                <div className="sl-field">
                  <label htmlFor="c-email">E-mail</label>
                  <input id="c-email" type="email" placeholder="voce@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="sl-field">
                  <label htmlFor="c-senha">Senha</label>
                  <div className="sl-senha"><input id="c-senha" type={ver ? "text" : "password"} placeholder="Mínimo 8 caracteres" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="new-password" minLength={8} /><button type="button" className="sl-olho" onClick={() => setVer(v => !v)} aria-pressed={ver}>{ver ? "Ocultar" : "Mostrar"}</button></div>
                </div>
                <button type="submit" className="sl-btn" disabled={carregando}>{carregando ? "Criando conta…" : "Criar minha conta grátis"}</button>
              </form>
            )}

            {aba === "esqueci" && (
              <form className="sl-fields" onSubmit={recuperar}>
                <p className="sl-sub">Digite o e-mail da sua conta. Vamos mandar um link para você criar uma senha nova.</p>
                <div className="sl-field">
                  <label htmlFor="r-email">E-mail</label>
                  <input id="r-email" type="email" placeholder="voce@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <button type="submit" className="sl-btn" disabled={carregando}>{carregando ? "Enviando…" : "Enviar link"}</button>
                <div className="sl-voltar"><button type="button" className="sl-link" onClick={() => trocar("login")}>Voltar para entrar</button></div>
              </form>
            )}

            <div className="sl-trust">
              <div className="sl-trust-item"><div className="sl-dot" /> 3 dias grátis</div>
              <div className="sl-trust-item"><div className="sl-dot" /> Cancele quando quiser</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
