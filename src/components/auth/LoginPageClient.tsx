"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { TextInput } from "../ui/TextInput";

export function LoginPageClient() {
  const router = useRouter();
  const { error, login } = useAuth();
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Nao foi possivel entrar. Verifique email e senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <header className="auth-card__header auth-card__header--center">
          <strong>CARIOCA&apos;S PRO</strong>
          <h1>Faca login para continuar</h1>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          <TextInput
            icon="@"
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            required
            type="email"
            value={email}
          />

          <TextInput
            icon="*"
            label="Senha"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            required
            type="password"
            value={password}
          />

          <Button disabled={loading} fullWidth type="submit" variant="primary">
            {loading ? <Spinner label="Entrando" /> : "Entrar"}
          </Button>
        </form>

        {error || localError ? <p className="auth-card__error">{error ?? localError}</p> : null}

        <div className="auth-links">
          <Link href="/cadastro">Nao tem conta? Cadastre-se</Link>
          <button type="button">Esqueceu a senha?</button>
        </div>
      </section>
    </main>
  );
}
