"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Spinner } from "../ui/Spinner";
import { TextInput } from "../ui/TextInput";

const tipoContaOptions = [
  { label: "Hamburgueria / Restaurante", value: "Hamburgueria / Restaurante" },
  { label: "Outro", value: "Outro" },
];

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function CadastroPageClient() {
  const router = useRouter();
  const { error, register } = useAuth();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [tipoConta, setTipoConta] = useState(tipoContaOptions[0].value);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    if (!nome.trim()) {
      setLocalError("Informe seu nome completo.");
      return;
    }

    if (!isValidEmail(email)) {
      setLocalError("Informe um email valido.");
      return;
    }

    if (password.length < 6) {
      setLocalError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("As senhas precisam ser iguais.");
      return;
    }

    setLoading(true);

    try {
      await register(email, password, nome, tipoConta);
      router.push("/dashboard");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Nao foi possivel criar a conta agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <header className="auth-card__header auth-card__header--center">
          <strong>CARIOCA&apos;S PRO</strong>
          <h1>Crie sua conta</h1>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          <TextInput
            label="Nome completo"
            onChange={(event) => setNome(event.target.value)}
            placeholder="Seu nome"
            required
            value={nome}
          />

          <TextInput
            label="Email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@empresa.com"
            required
            type="email"
            value={email}
          />

          <TextInput
            label="Senha"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimo 6 caracteres"
            required
            type="password"
            value={password}
          />

          <TextInput
            label="Confirmar senha"
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repita sua senha"
            required
            type="password"
            value={confirmPassword}
          />

          <Select
            label="Tipo de conta"
            onChange={(event) => setTipoConta(event.target.value)}
            options={tipoContaOptions}
            value={tipoConta}
          />

          <Button disabled={loading} fullWidth type="submit" variant="primary">
            {loading ? <Spinner label="Criando conta" /> : "Criar Conta"}
          </Button>
        </form>

        {error || localError ? <p className="auth-card__error">{error ?? localError}</p> : null}

        <div className="auth-links">
          <Link href="/login">Ja tem conta? Faca login</Link>
        </div>
      </section>
    </main>
  );
}
