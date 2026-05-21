"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getComposicaoCustos,
  getEvolucaoMensal,
  getKpisFinanceiro,
  type ComposicaoCusto,
  type KpisFinanceiro,
  type PontoEvolucao,
} from "../services/financeiro.service";

interface FinanceiroData {
  kpis: KpisFinanceiro | null;
  evolucao: PontoEvolucao[];
  composicao: ComposicaoCusto[];
  loading: boolean;
  error: string | null;
  refetch: (inicio?: Date, fim?: Date) => void;
}

export function useFinanceiro(): FinanceiroData {
  const periodoInicial = useMemo(() => {
    const hoje = new Date();
    return {
      fim: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59),
      inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
    };
  }, []);

  const [periodo, setPeriodo] = useState(periodoInicial);
  const [kpis, setKpis] = useState<KpisFinanceiro | null>(null);
  const [evolucao, setEvolucao] = useState<PontoEvolucao[]>([]);
  const [composicao, setComposicao] = useState<ComposicaoCusto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(
    async (inicio?: Date, fim?: Date) => {
      const dataInicio = inicio || periodo.inicio;
      const dataFim = fim || periodo.fim;
      setPeriodo({ fim: dataFim, inicio: dataInicio });
      setLoading(true);

      try {
        const [kpisData, evolucaoData, composicaoData] = await Promise.all([
          getKpisFinanceiro(dataInicio, dataFim),
          getEvolucaoMensal(6),
          getComposicaoCustos(),
        ]);

        setComposicao(composicaoData);
        setEvolucao(evolucaoData);
        setKpis(kpisData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados financeiros");
      } finally {
        setLoading(false);
      }
    },
    [periodo.fim, periodo.inicio],
  );

  useEffect(() => {
    carregar(periodoInicial.inicio, periodoInicial.fim);
  }, [carregar, periodoInicial.fim, periodoInicial.inicio]);

  return { composicao, error, evolucao, kpis, loading, refetch: carregar };
}
