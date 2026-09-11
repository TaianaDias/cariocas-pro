"use client";

import { useEffect, useState } from "react";

import { isOperationalRole } from "../lib/access-control";
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
  Insumo,
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

function getOperationalDashboard(items: Insumo[]) {
  const itensCriticos = items.filter((item) => item.quantidadeAtual <= item.estoqueMinimo).length;
  const reposicaoPendente = items.filter((item) => item.quantidadeAtual <= 0).length;

  const produtosVencer = items
    .filter((item) => item.validadeOriginal > 0 && item.validadeOriginal <= 3)
    .map((insumo) => ({ insumo, diasRestantes: insumo.validadeOriginal }))
    .sort((a, b) => a.diasRestantes - b.diasRestantes)
    .slice(0, 5);

  const previsaoRuptura = items
    .filter((item) => item.quantidadeAtual <= item.estoqueMinimo && item.quantidadeAtual > 0)
    .map((insumo) => ({
      insumo,
      probabilidade: Math.round((1 - insumo.quantidadeAtual / (insumo.estoqueMinimo || 1)) * 100),
      previsaoDias: Math.max(1, Math.round(insumo.quantidadeAtual / 2)),
    }))
    .sort((a, b) => b.probabilidade - a.probabilidade)
    .slice(0, 5);

  const comprasRecomendadas = items
    .filter((item) => item.quantidadeAtual <= item.estoqueMinimo && item.estoqueMinimo > 0)
    .map((insumo) => ({
      insumo,
      quantidadeRecomendada: Math.max(0, itemMaximo(insumo) - insumo.quantidadeAtual),
      custoEstimado: 0,
    }))
    .filter((item) => item.quantidadeRecomendada > 0)
    .sort((a, b) => b.quantidadeRecomendada - a.quantidadeRecomendada)
    .slice(0, 5);

  const kpis: DashboardKpis = {
    custoDoDia: 0,
    variacaoCusto: 0,
    desperdicioPercentual: 0,
    variacaoDesperdicio: 0,
    itensCriticos,
    reposicaoPendente,
  };

  return { comprasRecomendadas, kpis, previsaoRuptura, produtosVencer };
}

function itemMaximo(item: Insumo) {
  return item.estoqueMaximo > 0 ? item.estoqueMaximo : item.estoqueMinimo;
}

export function useDashboardData(): DashboardData {
  const { user, userProfile } = useAuth();
  const empresaId = userProfile?.empresaId || user?.uid || "";
  const lojaId = userProfile?.lojaId || "matriz";
  const operational = isOperationalRole(userProfile?.role);
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
        if (operational) {
          if (!user) throw new Error("Sessão inválida.");
          const token = await user.getIdToken();
          const response = await fetch("/api/estoque/operacional", {
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          const payload = (await response.json().catch(() => ({}))) as { error?: string; items?: Insumo[] };
          if (!response.ok) throw new Error(payload.error || "Erro ao carregar dashboard operacional.");

          const operationalData = getOperationalDashboard(payload.items || []);
          if (!mounted) return;
          setData({ ...operationalData, loading: false, error: null });
          return;
        }

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

    void carregar();

    return () => {
      mounted = false;
    };
  }, [empresaId, lojaId, operational, user]);

  return data;
}
