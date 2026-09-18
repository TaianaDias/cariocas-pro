"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { authenticatedFetch } from "../lib/authenticated-fetch";
import type {
  ComposicaoCusto,
  KpisFinanceiro,
  PontoEvolucao,
} from "../services/financeiro.service";
import { useAuth } from "./useAuth";

interface FinanceiroData {
  kpis: KpisFinanceiro | null;
  evolucao: PontoEvolucao[];
  composicao: ComposicaoCusto[];
  loading: boolean;
  error: string | null;
  refetch: (inicio?: Date, fim?: Date) => void;
}

type FinanceiroPayload = {
  composicao?: ComposicaoCusto[];
  error?: string;
  evolucao?: PontoEvolucao[];
  kpis?: KpisFinanceiro;
};

export function useFinanceiro(): FinanceiroData {
  const { loading: authLoading, user, userProfile } = useAuth();
  const periodoInicial = useMemo(() => {
    const hoje = new Date();
    return {
      fim: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59),
      inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
    };
  }, []);

  const [kpis, setKpis] = useState<KpisFinanceiro | null>(null);
  const [evolucao, setEvolucao] = useState<PontoEvolucao[]>([]);
  const [composicao, setComposicao] = useState<ComposicaoCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(
    async (inicio?: Date, fim?: Date) => {
      if (authLoading || !user || !userProfile?.empresaId || !userProfile?.lojaId) return;

      const dataInicio = inicio || periodoInicial.inicio;
      const dataFim = fim || periodoInicial.fim;

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          fim: dataFim.toISOString(),
          inicio: dataInicio.toISOString(),
        });
        const response = await authenticatedFetch(user, `/api/financeiro/resumo?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as FinanceiroPayload;

        if (!response.ok) {
          throw new Error(payload.error || "Não foi possível carregar os dados financeiros.");
        }

        setComposicao(Array.isArray(payload.composicao) ? payload.composicao : []);
        setEvolucao(Array.isArray(payload.evolucao) ? payload.evolucao : []);
        setKpis(payload.kpis || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados financeiros");
      } finally {
        setLoading(false);
      }
    },
    [
      authLoading,
      periodoInicial.fim,
      periodoInicial.inicio,
      user,
      userProfile?.empresaId,
      userProfile?.lojaId,
    ],
  );

  useEffect(() => {
    if (authLoading || !user || !userProfile?.empresaId || !userProfile?.lojaId) return;
    void carregar(periodoInicial.inicio, periodoInicial.fim);
  }, [
    authLoading,
    carregar,
    periodoInicial.fim,
    periodoInicial.inicio,
    user,
    userProfile?.empresaId,
    userProfile?.lojaId,
  ]);

  return { composicao, error, evolucao, kpis, loading, refetch: carregar };
}
