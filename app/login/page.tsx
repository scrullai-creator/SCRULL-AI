"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase-browser";

export default function Login() {
  const router = useRouter();
  const [aba, setAba] = useState<"login" | "cadastro">("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  // /login?aba=cadastro abre direto em "Criar conta" (link da página de vendas)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("aba") === "cadastro") setAba("cadastro");
  }, []);

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
  }  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .sl-root{min-height:100vh;background:#0a0612;display:flex;align-items:center;justify-content:center;padding:32px 16px;font-family:'Inter',system-ui,sans-serif;position:relative;overflow:hidden;color:#f0eaff}
        .sl-orb{position:fixed;border-radius:50%;pointer-events:none;z-index:0;filter:blur(80px);opacity:.4}
        .sl-orb-1{width:500px;height:500px;background:radial-gradient(circle,#5b21b6 0%,transparent 70%);top:-150px;left:-100px;animation:sldrift 20s ease-in-out infinite alternate}
        .sl-orb-2{width:400px;height:400px;background:radial-gradient(circle,#7c3aed 0%,transparent 70%);bottom:-100px;right:-80px;animation:sldrift 20s ease-in-out infinite alternate;animation-delay:-7s}
        .sl-orb-3{width:300px;height:300px;background:radial-gradient(circle,#4c1d95 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%);animation:sldrift 20s ease-in-out infinite alternate;animation-delay:-14s}
        @keyframes sldrift{from{transform:translate(0,0) scale(1)}to{transform:translate(30px,20px) scale(1.08)}}
        .sl-grid{position:fixed;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(rgba(139,92,246,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,.06) 1px,transparent 1px);background-size:48px 48px;-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 100%);mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 20%,transparent 100%)}
        .sl-wrap{position:relative;z-index:1;width:100%;max-width:420px}
        .sl-wrap::before{content:'';position:absolute;inset:-1px;border-radius:25px;background:linear-gradient(135deg,rgba(139,92,246,.4),rgba(76,29,149,.2),transparent 60%);z-index:-1}
        .sl-card{background:rgba(255,255,255,.045);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);border:1px solid rgba(255,255,255,.09);border-radius:24px;padding:40px 36px 36px;display:flex;flex-direction:column;gap:24px}
        .sl-brand{display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center}
        .sl-logo{width:60px;height:60px;background:linear-gradient(135deg,#7c3aed,#5b21b6);border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 32px rgba(124,58,237,.35),0 4px 16px rgba(0,0,0,.5)}
        .sl-mascote{width:120px;height:120px;border-radius:28px;box-shadow:0 0 44px rgba(124,58,237,.55),0 6px 20px rgba(0,0,0,.5);animation:slflut 4s ease-in-out infinite}
        @keyframes slflut{50%{transform:translateY(-6px)}}
        .sl-name{font-family:'Syne',system-ui,sans-serif;font-size:26px;font-weight:800;letter-spacing:-.5px;color:#f0eaff;line-height:1}
        .sl-name span{color:#9f67ff}
        .sl-tag{font-size:13px;color:#9d8fc0}
        .sl-tabs{display:grid;grid-template-columns:1fr 1fr;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:4px;gap:4px}
        .sl-tab{background:transparent;border:none;color:#6b5f8a;font-family:'Inter',system-ui,sans-serif;font-size:14px;font-weight:600;padding:10px;border-radius:9px;cursor:pointer;transition:all .2s ease}
        .sl-tab.ativo{background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;box-shadow:0 2px 12px rgba(124,58,237,.4)}
        .sl-fields{display:flex;flex-direction:column;gap:14px}
        .sl-field{display:flex;flex-direction:column;gap:6px}
        .sl-field label{font-size:12.5px;font-weight:600;color:#9d8fc0;letter-spacing:.06em;text-transform:uppercase}
        .sl-field input{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.09);border-radius:11px;color:#f0eaff;font-family:'Inter',system-ui,sans-serif;font-size:15px;padding:13px 15px;outline:none;transition:border-color .2s,box-shadow .2s;width:100%}
        .sl-field input::placeholder{color:#6b5f8a}
        .sl-field input:focus{border-color:rgba(139,92,246,.6);box-shadow:0 0 0 3px rgba(124,58,237,.15)}
        .sl-erro{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);border-radius:10px;color:#fca5a5;font-size:13.5px;padding:11px 14px}
        .sl-ok{background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.25);border-radius:10px;color:#6ee7b7;font-size:13.5px;padding:11px 14px}
        .sl-btn{background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);border:none;border-radius:12px;color:white;cursor:pointer;font-family:'Inter',system-ui,sans-serif;font-size:15px;font-weight:600;padding:15px;width:100%;transition:transform .15s ease,box-shadow .15s ease;box-shadow:0 4px 20px rgba(124,58,237,.4),0 1px 4px rgba(0,0,0,.3)}
        .sl-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 28px rgba(124,58,237,.5)}
        .sl-btn:disabled{opacity:.6;cursor:default}
        .sl-senha{position:relative}.sl-senha input{padding-right:84px}
        .sl-olho{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(139,92,246,.18);border:0;border-radius:8px;color:#c4b5fd;font:600 12.5px 'Inter',system-ui,sans-serif;padding:7px 10px;cursor:pointer}
        .sl-olho:hover{background:rgba(139,92,246,.32)}.sl-olho:active{transform:translateY(-50%) scale(.94)}
        .sl-btn:active:not(:disabled),.sl-tab:active{transform:scale(.97)}
        .sl-btn:disabled::before{content:'';display:inline-block;width:14px;height:14px;margin-right:8px;vertical-align:-2px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:slgiro .7s linear infinite}
        @keyframes slgiro{to{transform:rotate(360deg)}}
        .sl-divider{height:1px;background:rgba(255,255,255,.09)}
        .sl-trust{display:flex;align-items:center;justify-content:center;gap:20px}
        .sl-trust-item{display:flex;align-items:center;gap:5px;font-size:11.5px;color:#6b5f8a}
        .sl-dot{width:5px;height:5px;border-radius:50%;background:#9f67ff;opacity:.6}
        @media(max-width:460px){.sl-card{padding:32px 24px 28px}.sl-name{font-size:22px}.sl-trust{gap:12px}}
        @media(prefers-reduced-motion:reduce){.sl-orb,.sl-mascote{animation:none}}
      `}</style>      <div className="sl-root">
        <div className="sl-orb sl-orb-1" />
        <div className="sl-orb sl-orb-2" />
        <div className="sl-orb sl-orb-3" />
        <div className="sl-grid" />
        <div className="sl-wrap">
          <div className="sl-card">
            <div className="sl-brand">
              <img className="sl-mascote" src="/mascote.png" alt="Mascote do Scrull AI" width={120} height={120} />
              <div>
                <div className="sl-name">SCRULL <span>AI</span></div>
                <div className="sl-tag">Seu Instagram no automático!</div>
              </div>
            </div>
            <div className="sl-tabs">
              <button className={`sl-tab${aba === "login" ? " ativo" : ""}`} onClick={() => { setAba("login"); setErro(""); setMsg(""); }}>Entrar</button>
              <button className={`sl-tab${aba === "cadastro" ? " ativo" : ""}`} onClick={() => { setAba("cadastro"); setErro(""); setMsg(""); }}>Criar conta</button>
            </div>
            {erro && <div className="sl-erro" role="alert">{erro}</div>}
            {msg  && <div className="sl-ok"  role="status">{msg}</div>}            {aba === "login" && (
              <form className="sl-fields" onSubmit={entrar}>
                <div className="sl-field">
                  <label htmlFor="l-email">E-mail</label>
                  <input id="l-email" type="email" placeholder="voce@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="sl-field">
                  <label htmlFor="l-senha">Senha</label>
                  <div className="sl-senha"><input id="l-senha" type={ver ? "text" : "password"} placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password" /><button type="button" className="sl-olho" onClick={() => setVer(v => !v)} aria-pressed={ver}>{ver ? "Ocultar" : "Mostrar"}</button></div>
                </div>
                <button type="submit" className="sl-btn" disabled={carregando}>{carregando ? "Entrando…" : "Entrar →"}</button>
              </form>
            )}
            {aba === "cadastro" && (
              <form className="sl-fields" onSubmit={cadastrar}>
                <div className="sl-field">
                  <label htmlFor="c-nome">Nome do negócio</label>
                  <input id="c-nome" type="text" placeholder="Ex: Nome da sua empresa" value={nome} onChange={e => setNome(e.target.value)} required autoComplete="organization" />
                </div>
                <div className="sl-field">
                  <label htmlFor="c-email">E-mail</label>
                  <input id="c-email" type="email" placeholder="voce@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="sl-field">
                  <label htmlFor="c-senha">Senha</label>
                  <div className="sl-senha"><input id="c-senha" type={ver ? "text" : "password"} placeholder="Mínimo 8 caracteres" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="new-password" minLength={8} /><button type="button" className="sl-olho" onClick={() => setVer(v => !v)} aria-pressed={ver}>{ver ? "Ocultar" : "Mostrar"}</button></div>
                </div>
                <button type="submit" className="sl-btn" disabled={carregando}>{carregando ? "Criando conta…" : "Começar 7 dias grátis →"}</button>
              </form>
            )}
            <div className="sl-divider" />
            <div className="sl-trust">
              <div className="sl-trust-item"><div className="sl-dot" /> Demonstração grátis</div>
              <div className="sl-trust-item"><div className="sl-dot" /> Cancele quando quiser</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
