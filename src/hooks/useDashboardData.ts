"use client";

import { useEffect, useState } from "react";

import {
  getComprasRecomendadas,
  getKpis,
  getPrevisaoRuptura,
  getProdutosAVencer,
} from "../services/dashboard.service";
import { useAuth } from "./useAuth";
import type {
  CompraRecomendada,
  DashboardKpis,
  ProdutoVencimento,
  Ruptura,
} from "../types";

interface DashboardData {
  kpis: DashboardKpis | null;
  produtosVencer: ProdutoVencimento[];
  previsaoRuptura: Ruptura[];
  comprasRecomendadas: CompraRecomendada[];
  loading: boolean;
  error: string | null;
}

export function useDashboardData(): DashboardData {
  const { user, userProfile } = useAuth();
  const empresaId = userProfile?.empresaId || user?.uid || "";
  const lojaId = userProfile?.lojaId || "matriz";
  const [data, setData] = useState<DashboardData>({
    kpis: null,
    produtosVencer: [],
    previsaoRuptura: [],
    comprasRecomendadas: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function carregar() {
      try {
        const [kpis, produtosVencer, previsaoRuptura, comprasRecomendadas] = await Promise.all([
          getKpis({ empresaId, lojaId }),
          getProdutosAVencer(3, { empresaId, lojaId }),
          getPrevisaoRuptura({ empresaId, lojaId }),
          getComprasRecomendadas({ empresaId, lojaId }),
        ]);

        if (!mounted) return;

        setData({
          kpis,
          produtosVencer,
          previsaoRuptura,
          comprasRecomendadas,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (!mounted) return;
        setData((current) => ({
          ...current,
          loading: false,
          error: err instanceof Error ? err.message : "Erro ao carregar dashboard",
        }));
      }
    }

    carregar();

    return () => {
      mounted = false;
    };
  }, [empresaId, lojaId]);

  return data;
}
