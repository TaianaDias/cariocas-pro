"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type InputChatProps = {
  disabled?: boolean;
  loading: boolean;
  onSend: (texto: string) => void;
};

export function InputChat({ disabled = false, loading, onSend }: InputChatProps) {
  const [texto, setTexto] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!texto.trim() || disabled || loading) return;
    onSend(texto);
    setTexto("");
  }

  return (
    <form className="carioquinha-input" onSubmit={handleSubmit}>
      <label>
        <span>Mensagem para IA Carioquinha</span>
        <textarea
          disabled={disabled || loading}
          onChange={(event) => setTexto(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Pergunte sobre estoque, reposicao, CMV ou operacao..."
          rows={3}
          value={texto}
        />
      </label>
      <button type="submit" aria-label="Enviar mensagem" disabled={disabled || loading}>
        <span aria-hidden="true">Enviar</span>
      </button>
    </form>
  );
}
