"use client";

import { useCallback, useState } from "react";

import {
  getRelatorioCompras,
  getRelatorioProdutos,
  getResumoRelatorio,
  type RelatorioPedidos,
  type RelatorioProduto,
  type ResumoRelatorio,
} from "../services/relatorios.service";

export function useRelatorios() {
  const [resumo, setResumo] = useState<ResumoRelatorio | null>(null);
  const [compras, setCompras] = useState<RelatorioPedidos[]>([]);
  const [produtos, setProdutos] = useState<RelatorioProduto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gerarRelatorio = useCallback(async (inicio: Date, fim: Date) => {
    setLoading(true);
    setError(null);

    try {
      const [resumoData, comprasData, produtosData] = await Promise.all([
        getResumoRelatorio(inicio, fim),
        getRelatorioCompras(inicio, fim),
        getRelatorioProdutos(inicio, fim),
      ]);

      setCompras(comprasData);
      setProdutos(produtosData);
      setResumo(resumoData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar relatorio");
    } finally {
      setLoading(false);
    }
  }, []);

  return { compras, error, gerarRelatorio, loading, produtos, resumo };
}
