"use client";

import { useCallback, useState } from "react";

import { auth } from "../lib/firebase";

export interface MensagemCarioquinha {
  id: string;
  texto: string;
  sender: "user" | "ai";
  timestamp: Date;
}

export function useCarioquinha() {
  const [mensagens, setMensagens] = useState<MensagemCarioquinha[]>([]);
  const [loading, setLoading] = useState(false);

  const enviar = useCallback(
    async (texto: string) => {
      const trimmed = texto.trim();
      if (!trimmed || loading) return;

      const userMsg: MensagemCarioquinha = {
        id: `user-${Date.now()}`,
        texto: trimmed,
        sender: "user",
        timestamp: new Date(),
      };

      setMensagens((current) => [...current, userMsg]);
      setLoading(true);

      try {
        const user = auth.currentUser;
        if (!user) throw new Error("Sessão expirada. Entre novamente para continuar.");
        const token = await user.getIdToken();
        const response = await fetch("/api/carioquinha", {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pergunta: trimmed }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string; resposta?: string };
        if (!response.ok) throw new Error(payload.error || "Não foi possível processar sua mensagem.");

        const aiMsg: MensagemCarioquinha = {
          id: `ai-${Date.now()}`,
          texto: payload.resposta || "Comando processado.",
          sender: "ai",
          timestamp: new Date(),
        };
        setMensagens((current) => [...current, aiMsg]);
      } catch (error) {
        setMensagens((current) => [
          ...current,
          {
            id: `ai-${Date.now()}`,
            texto: error instanceof Error ? error.message : "Não consegui processar sua pergunta. Tente novamente.",
            sender: "ai",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  return { mensagens, loading, enviar };
}
