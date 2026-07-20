import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { LogIn, UserPlus, KeyRound, Mail, AlertCircle, Eye, EyeOff } from "lucide-react";

export function AuthPage({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setError("Cadastro realizado com sucesso! Verifique seu e-mail ou faça login.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "var(--bg)", padding: "20px" }}>
      <div style={{ maxWidth: "400px", width: "100%", background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "32px", boxShadow: "0 8px 32px rgba(0,0,0,0.24)" }}>
        <header style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em", marginBottom: "8px" }}>financas<span style={{ color: "#ff7a18" }}>v3</span></div>
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
            {isSignUp ? "Crie uma nova conta protegida na nuvem" : "Acesse seu painel financeiro seguro"}
          </p>
        </header>

        {error && (
          <div style={{ background: "rgba(255,122,24,0.08)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "12px", display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px", fontSize: "12px", color: "var(--text)" }}>
            <AlertCircle size={16} style={{ color: "#ff7a18", flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "var(--muted-2)", fontWeight: "bold", display: "block", marginBottom: "6px" }}>Endereço de e-mail</label>
            <div style={{ position: "relative" }}>
              <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                type="email"
                required
                className="search-input"
                style={{ width: "100%", paddingLeft: "36px", height: "40px" }}
                placeholder="nome@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "var(--muted-2)", fontWeight: "bold", display: "block", marginBottom: "6px" }}>Senha de acesso</label>
            <div style={{ position: "relative" }}>
              <KeyRound size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                type={showPassword ? "text" : "password"}
                required
                className="search-input"
                style={{ width: "100%", paddingLeft: "36px", paddingRight: "36px", height: "40px" }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="primary-button" style={{ height: "42px", justifyContent: "center", gap: "8px", marginTop: "10px" }} disabled={loading}>
            {isSignUp ? <UserPlus size={18} /> : <LogIn size={18} />}
            {loading ? "Processando..." : isSignUp ? "Cadastrar Conta" : "Entrar no Sistema"}
          </button>
        </form>

        <footer style={{ marginTop: "24px", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
          <button
            className="text-button"
            style={{ fontSize: "13px", color: "var(--muted)" }}
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
          >
            {isSignUp ? "Já possui conta? Faça Login" : "Criar uma nova conta segura"}
          </button>
        </footer>
      </div>
    </div>
  );
}
