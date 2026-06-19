"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "./useAuth";
import { listarCategorias } from "../services/categorias.service";
import { listarInsumos } from "../services/estoque.service";
import type { Categoria, Insumo } from "../types";

type EstoqueKpiData = {
  abaixoMinimo: number;
  proxVencimento: number;
  semFornecedor: number;
  precisaEtiqueta: number;
  aumentoCusto: number;
  margemBaixa: number;
};

interface EstoqueData {
  insumos: Insumo[];
  categorias: Categoria[];
  kpis: EstoqueKpiData;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const kpisVazios: EstoqueKpiData = {
  abaixoMinimo: 0,
  proxVencimento: 0,
  semFornecedor: 0,
  precisaEtiqueta: 0,
  aumentoCusto: 0,
  margemBaixa: 0,
};

export function useEstoqueData(): EstoqueData {
  const { user, userProfile } = useAuth();
  const empresaId = userProfile?.empresaId || user?.uid || "";
  const lojaId = userProfile?.lojaId || "matriz";
  const [data, setData] = useState<EstoqueData>({
    insumos: [],
    categorias: [],
    kpis: kpisVazios,
    loading: true,
    error: null,
    refetch: () => undefined,
  });

  const carregar = useCallback(async () => {
    setData((current) => ({ ...current, loading: true, error: null }));

    try {
      if (!empresaId || !lojaId) {
        setData({
          insumos: [],
          categorias: [],
          kpis: kpisVazios,
          loading: false,
          error: null,
          refetch: carregar,
        });
        return;
      }

      const [insumos, categorias] = await Promise.all([
        listarInsumos({ empresaId, lojaId }),
        listarCategorias({ empresaId }),
      ]);

      const abaixoMinimo = insumos.filter(
        (insumo) => insumo.quantidadeAtual <= insumo.estoqueMinimo && insumo.estoqueMinimo > 0,
      ).length;
      const proxVencimento = insumos.filter(
        (insumo) => insumo.validadeOriginal > 0 && insumo.validadeOriginal <= 3,
      ).length;
      const semFornecedor = insumos.filter((insumo) => !insumo.fornecedorPrincipal).length;
      const precisaEtiqueta = insumos.filter((insumo) => !insumo.tipoEtiqueta).length;
      const margemBaixa = insumos.filter(
        (insumo) => insumo.margemEstimada > 0 && insumo.margemEstimada < 40,
      ).length;

      setData({
        insumos,
        categorias,
        kpis: {
          abaixoMinimo,
          proxVencimento,
          semFornecedor,
          precisaEtiqueta,
          aumentoCusto: 0,
          margemBaixa,
        },
        loading: false,
        error: null,
        refetch: carregar,
      });
    } catch (err) {
      setData((current) => ({
        ...current,
        loading: false,
        error: err instanceof Error ? err.message : "Erro ao carregar estoque",
        refetch: carregar,
      }));
    }
  }, [empresaId, lojaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return data;
}
