"use client";

import { useCallback, useEffect, useState } from "react";

import type { AlertaReposicao } from "../services/alertas.service";
import { useAuth } from "./useAuth";

export function useAlertas() {
  const { user } = useAuth();
  const [alertas, setAlertas] = useState<AlertaReposicao[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) {
      setAlertas([]);
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/alertas", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as { items?: AlertaReposicao[] };
      if (!response.ok) throw new Error("Não foi possível carregar os alertas.");
      setAlertas(data.items || []);
    } catch {
      setAlertas([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void carregar();
    const timer = window.setInterval(() => void carregar(), 60000);
    return () => window.clearInterval(timer);
  }, [carregar]);

  const executarAcao = useCallback(async (alertaId: string, action: "read" | "resolve", observacao?: string) => {
    if (!user) throw new Error("Sessão inválida.");
    const token = await user.getIdToken();
    const response = await fetch("/api/alertas", {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, alertaId, observacao }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Não foi possível atualizar o alerta.");
    }

    if (action === "read") {
      setAlertas((current) => current.map((item) => item.id === alertaId ? { ...item, lido: true } : item));
    } else {
      setAlertas((current) => current.filter((item) => item.id !== alertaId));
    }
  }, [user]);

  const marcarLido = useCallback((alertaId: string) => executarAcao(alertaId, "read"), [executarAcao]);
  const resolver = useCallback((alertaId: string, _responsavel?: string, observacao?: string) => executarAcao(alertaId, "resolve", observacao), [executarAcao]);

  const criticos = alertas.filter((alerta) => alerta.nivel === "critical");
  const warnings = alertas.filter((alerta) => alerta.nivel === "warning");
  const contagemNaoLidos = alertas.filter((alerta) => !alerta.lido).length;

  return {
    alertas,
    contagemNaoLidos,
    criticos,
    loading,
    marcarLido,
    resolver,
    warnings,
  };
}
