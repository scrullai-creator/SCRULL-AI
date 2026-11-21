"use client";
// Criar senha nova: aberta pelo link do e-mail de "Esqueci minha senha" (o link já deixa a pessoa logada)
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase-browser";
import { Cena } from "../login/cena";

export default function NovaSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
    if (senha !== conf) return setErro("As duas senhas não são iguais.");
    setCarregando(true);
    try {
      const s = supabaseNavegador();
      const { data: { user } } = await s.auth.getUser();
      if (!user) return setErro("O link expirou. Volte para a tela de entrar e peça um novo em \"Esqueci minha senha\".");
      const { error } = await s.auth.updateUser({ password: senha });
      if (error) return setErro(/weak|password/i.test(error.message) ? "Senha fraca. Misture letras e números." : "Não foi possível salvar a senha. Tente de novo.");
      router.push("/painel");
      router.refresh();
    } finally { setCarregando(false); }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, position: "relative", fontFamily: "Inter, system-ui, sans-serif" }}>
      <Cena id="ns" className="ns-fundo" />
      <style>{`.ns-fundo{position:fixed;inset:0;width:100%;height:100%}
        .ns{position:relative;width:100%;max-width:400px;background:#fff;border-radius:24px;padding:30px 28px;box-shadow:0 30px 80px rgba(20,8,60,.55);color:#24124d;display:flex;flex-direction:column;gap:14px}
        .ns h1{font-size:22px;margin:0}.ns p{color:#5b4b85;font-size:14px;margin:0}
        .ns label{font-size:13px;font-weight:600;color:#4b3a78;display:block;margin-bottom:6px}
        .ns input{width:100%;background:#faf8ff;border:1.5px solid #e4dcf7;border-radius:12px;font:500 15px Inter,system-ui,sans-serif;padding:13px 15px;color:#24124d}
        .ns input:focus{outline:none;border-color:#8b5cf6;box-shadow:0 0 0 4px rgba(139,92,246,.16)}
        .ns .b{background:linear-gradient(135deg,#7c3aed,#a855f7 55%,#d946ef);color:#fff;border:0;border-radius:12px;padding:15px;font:700 15px Inter,system-ui,sans-serif;cursor:pointer}
        .ns .b:disabled{opacity:.65}.ns .v{background:none;border:0;color:#6d28d9;font:600 13px Inter,system-ui,sans-serif;cursor:pointer;text-decoration:underline;align-self:flex-start}
        .ns .e{background:#fff1f3;border:1px solid #fecdd6;border-radius:10px;color:#be123c;font-size:13.5px;padding:11px 14px}`}</style>
      <form className="ns" onSubmit={salvar}>
        <h1>Criar senha nova</h1>
        <p>Escolha uma senha com pelo menos 8 caracteres.</p>
        {erro && <div className="e" role="alert">{erro}</div>}
        <div><label htmlFor="ns1">Senha nova</label><input id="ns1" type={ver ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" required minLength={8} /></div>
        <div><label htmlFor="ns2">Repita a senha</label><input id="ns2" type={ver ? "text" : "password"} value={conf} onChange={(e) => setConf(e.target.value)} autoComplete="new-password" required minLength={8} /></div>
        <button type="button" className="v" onClick={() => setVer((v) => !v)} aria-pressed={ver}>{ver ? "Ocultar senhas" : "Mostrar senhas"}</button>
        <button className="b" disabled={carregando}>{carregando ? "Salvando…" : "Salvar e entrar"}</button>
      </form>
    </div>
  );
}
