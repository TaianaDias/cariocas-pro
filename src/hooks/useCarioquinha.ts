"use client";

import { useCallback, useState } from "react";

import { processarPergunta } from "../services/carioquinha.service";

export interface MensagemCarioquinha {
  id: string;
  texto: string;
  sender: "user" | "ai";
  timestamp: Date;
}

export function useCarioquinha(uid = "") {
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
        const { resposta } = await processarPergunta(trimmed, uid);
        const aiMsg: MensagemCarioquinha = {
          id: `ai-${Date.now()}`,
          texto: resposta,
          sender: "ai",
          timestamp: new Date(),
        };
        setMensagens((current) => [...current, aiMsg]);
      } catch {
        setMensagens((current) => [
          ...current,
          {
            id: `ai-${Date.now()}`,
            texto: "Desculpe, nao consegui processar sua pergunta. Tente novamente.",
            sender: "ai",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, uid],
  );

  return { mensagens, loading, enviar };
}
