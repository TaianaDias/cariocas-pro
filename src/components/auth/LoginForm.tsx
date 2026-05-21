"use client";

import { useState, type FormEvent } from "react";

import { resetPassword, signInWithGoogle } from "../../lib/auth";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/Button";
import { TextInput } from "../ui/TextInput";

type AuthMode = "login" | "register" | "reset";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const { error, login, register } = useAuth();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setLoading(true);

    try {
      if (mode === "register") {
        await register(email, password, name);
        setFeedback("Conta criada com sucesso.");
      }

      if (mode === "login") {
        await login(email, password);
        setFeedback("Login realizado com sucesso.");
      }

      if (mode === "reset") {
        await resetPassword(email);
        setFeedback("Enviamos o link de recuperacao para seu email.");
      }
    } catch {
      setFeedback("Nao foi possivel concluir a autenticacao. Verifique os dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setFeedback("");
    setLoading(true);

    try {
      await signInWithGoogle();
      setFeedback("Login com Google realizado com sucesso.");
    } catch {
      setFeedback("Nao foi possivel entrar com Google agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-card">
      <header className="auth-card__header">
        <span>Firebase Auth</span>
        <h1>{mode === "register" ? "Criar conta" : mode === "reset" ? "Recuperar senha" : "Entrar"}</h1>
        <p>Acesse o Carioca's Pro 2026 com email e senha ou Google.</p>
      </header>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <TextInput
            label="Nome"
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do usuario"
            value={name}
          />
        ) : null}

        <TextInput
          label="Email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@empresa.com"
          type="email"
          value={email}
        />

        {mode !== "reset" ? (
          <TextInput
            label="Senha"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            type="password"
            value={password}
          />
        ) : null}

        <Button type="submit">{loading ? "Processando..." : mode === "reset" ? "Enviar link" : "Continuar"}</Button>
      </form>

      {mode !== "reset" ? (
        <Button type="button" variant="secondary" onClick={handleGoogleSignIn}>
          Entrar com Google
        </Button>
      ) : null}

      <div className="auth-card__switcher">
        <button type="button" onClick={() => setMode("login")}>
          Login
        </button>
        <button type="button" onClick={() => setMode("register")}>
          Criar conta
        </button>
        <button type="button" onClick={() => setMode("reset")}>
          Esqueci a senha
        </button>
      </div>

      {feedback || error ? <p className="auth-card__feedback">{error ?? feedback}</p> : null}
    </section>
  );
}
