"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase-browser";

export default function Login() {
  const router = useRouter();
  const [aba, setAba] = useState<"login" | "cadastro">("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(""); setMsg(""); setCarregando(true);
    try {
      const { error } = await supabaseNavegador().auth.signInWithPassword({ email, password: senha });
      if (error) return setErro("E-mail ou senha incorretos. Tente novamente.");
      router.push("/painel");
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
      if (error) return setErro("Não foi possível criar a conta. Confira os dados.");
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
        .sl-divider{height:1px;background:rgba(255,255,255,.09)}
        .sl-trust{display:flex;align-items:center;justify-content:center;gap:20px}
        .sl-trust-item{display:flex;align-items:center;gap:5px;font-size:11.5px;color:#6b5f8a}
        .sl-dot{width:5px;height:5px;border-radius:50%;background:#9f67ff;opacity:.6}
        @media(max-width:460px){.sl-card{padding:32px 24px 28px}.sl-name{font-size:22px}.sl-trust{gap:12px}}
        @media(prefers-reduced-motion:reduce){.sl-orb{animation:none}}
      `}</style>      <div className="sl-root">
        <div className="sl-orb sl-orb-1" />
        <div className="sl-orb sl-orb-2" />
        <div className="sl-orb sl-orb-3" />
        <div className="sl-grid" />
        <div className="sl-wrap">
          <div className="sl-card">
            <div className="sl-brand">
              <div className="sl-logo">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <rect x="6" y="10" width="20" height="15" rx="4" fill="white" fillOpacity="0.9"/>
                  <rect x="15" y="4" width="2" height="6" rx="1" fill="white" fillOpacity="0.9"/>
                  <circle cx="16" cy="4" r="2" fill="white"/>
                  <rect x="10" y="14" width="4" height="4" rx="1.5" fill="#7c3aed"/>
                  <rect x="18" y="14" width="4" height="4" rx="1.5" fill="#7c3aed"/>
                  <rect x="11" y="20" width="10" height="2" rx="1" fill="#7c3aed" fillOpacity="0.7"/>
                  <rect x="3" y="14" width="3" height="6" rx="1.5" fill="white" fillOpacity="0.7"/>
                  <rect x="26" y="14" width="3" height="6" rx="1.5" fill="white" fillOpacity="0.7"/>
                </svg>
              </div>
              <div>
                <div className="sl-name">SCRULL <span>AI</span></div>
                <div className="sl-tag">Instagram automation for your business</div>
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
                  <input id="l-senha" type="password" placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password" />
                </div>
                <button type="submit" className="sl-btn" disabled={carregando}>{carregando ? "Entrando…" : "Entrar →"}</button>
              </form>
            )}
            {aba === "cadastro" && (
              <form className="sl-fields" onSubmit={cadastrar}>
                <div className="sl-field">
                  <label htmlFor="c-nome">Nome do negócio</label>
                  <input id="c-nome" type="text" placeholder="Ex: Lá Romana Pizzaria" value={nome} onChange={e => setNome(e.target.value)} required autoComplete="organization" />
                </div>
                <div className="sl-field">
                  <label htmlFor="c-email">E-mail</label>
                  <input id="c-email" type="email" placeholder="voce@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="sl-field">
                  <label htmlFor="c-senha">Senha</label>
                  <input id="c-senha" type="password" placeholder="Mínimo 8 caracteres" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="new-password" minLength={8} />
                </div>
                <button type="submit" className="sl-btn" disabled={carregando}>{carregando ? "Criando conta…" : "Começar 7 dias grátis →"}</button>
              </form>
            )}
            <div className="sl-divider" />
            <div className="sl-trust">
              <div className="sl-trust-item"><div className="sl-dot" /> Sem cartão de crédito</div>
              <div className="sl-trust-item"><div className="sl-dot" /> Cancele quando quiser</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
