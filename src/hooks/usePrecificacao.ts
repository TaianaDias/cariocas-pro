"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { canSeePrecificacaoMoney, canUsePrecificacaoCompleta, hasPrecificacaoPermission } from "../lib/permissions";
import {
  atualizarIngredientesComEstoque,
  custosFixosPadrao,
  custosVariaveisPadrao,
  gerarAlertasFinanceiros,
  listarReceitasPrecificacao,
  mascararReceitaPrecificacao,
  metasPadrao,
  recalcularReceita,
  salvarCustosFixos,
  salvarReceitaPrecificacao,
} from "../services/precificacao.service";
import { listarInsumos } from "../services/estoque.service";
import type {
  CustosFixosPrecificacao,
  CustosVariaveisPrecificacao,
  Insumo,
  MetaFinanceiraPrecificacao,
  ReceitaPrecificacao,
} from "../types";
import { useAuth } from "./useAuth";

export function usePrecificacao() {
  const { user, userProfile } = useAuth();
  const plan = userProfile?.plano ?? userProfile?.plan ?? "free";
  const role = userProfile?.role ?? "user";
  const empresaId = userProfile?.empresaId || user?.uid || "default";
  const lojaId = userProfile?.lojaId;
  const lojaSegura = lojaId || "matriz";
  const [receitas, setReceitas] = useState<ReceitaPrecificacao[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [custosFixos, setCustosFixos] = useState<CustosFixosPrecificacao>({
    ...custosFixosPadrao,
    empresaId,
    lojaId: lojaSegura,
  });
  const [custosVariaveis, setCustosVariaveis] = useState<CustosVariaveisPrecificacao>(custosVariaveisPadrao);
  const [metas, setMetas] = useState<MetaFinanceiraPrecificacao>({
    ...metasPadrao,
    empresaId,
    lojaId: lojaSegura,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canSeeMoney = canSeePrecificacaoMoney(plan, role);
  const canUseFullModule = canUsePrecificacaoCompleta(plan, role);
  const canConfigure = hasPrecificacaoPermission("precificacao.configurar", plan, role);
  const canRecalculate = hasPrecificacaoPermission("precificacao.recalcular", plan, role);
  const canReport = hasPrecificacaoPermission("precificacao.relatorio", plan, role);

  const receitasCalculadas = useMemo(() => {
    if (!canSeeMoney) {
      return receitas.map(mascararReceitaPrecificacao);
    }

    return receitas.map((receita) =>
      recalcularReceita(
        {
          ...receita,
          ingredientes: atualizarIngredientesComEstoque(receita.ingredientes || [], insumos),
        },
        custosFixos,
        custosVariaveis,
        metas,
      ),
    );
  }, [canSeeMoney, custosFixos, custosVariaveis, insumos, metas, receitas]);

  const kpis = useMemo(() => {
    if (!canSeeMoney) {
      return { cmvMedio: 0, criticas: 0, custoTotal: 0, lucroTotal: 0, margemMedia: 0, maisLucrativa: undefined, piorCmv: undefined };
    }

    const total = receitasCalculadas.length || 1;
    const lucroTotal = receitasCalculadas.reduce((acc, item) => acc + item.lucro, 0);
    const custoTotal = receitasCalculadas.reduce((acc, item) => acc + item.custoTotalReal, 0);
    const margemMedia = receitasCalculadas.reduce((acc, item) => acc + item.margem, 0) / total;
    const cmvMedio = receitasCalculadas.reduce((acc, item) => acc + item.cmv, 0) / total;
    const criticas = receitasCalculadas.filter((item) => item.status === "critico").length;
    const maisLucrativa = [...receitasCalculadas].sort((a, b) => b.lucro - a.lucro)[0];
    const piorCmv = [...receitasCalculadas].sort((a, b) => b.cmv - a.cmv)[0];

    return { cmvMedio, criticas, custoTotal, lucroTotal, margemMedia, maisLucrativa, piorCmv };
  }, [canSeeMoney, receitasCalculadas]);

  const alertas = useMemo(
    () => (canSeeMoney ? gerarAlertasFinanceiros(receitasCalculadas, metas) : []),
    [canSeeMoney, metas, receitasCalculadas],
  );

  const carregar = useCallback(async () => {
    setLoading(true);

    try {
      if (!canSeeMoney) {
        const insumosData = await listarInsumos({ empresaId, lojaId: lojaSegura });
        setInsumos(insumosData);
        setReceitas([]);
        setError(null);
        return;
      }

      const [dados, insumosData] = await Promise.all([
        listarReceitasPrecificacao(empresaId, lojaSegura),
        listarInsumos({ empresaId, lojaId: lojaSegura }),
      ]);
      setReceitas(dados);
      setInsumos(insumosData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar precificacao.");
    } finally {
      setLoading(false);
    }
  }, [canSeeMoney, empresaId, lojaSegura]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarReceita(receita: Partial<ReceitaPrecificacao>) {
    const recalculada = recalcularReceita(
      {
        ...receita,
        createdBy: user?.uid || "sistema",
        empresaId,
        ingredientes: atualizarIngredientesComEstoque(receita.ingredientes || [], insumos),
        lojaId: lojaSegura,
      },
      custosFixos,
      custosVariaveis,
      metas,
    );

    await salvarReceitaPrecificacao(recalculada);
    await carregar();
  }

  async function salvarCustos(novosCustos: CustosFixosPrecificacao) {
    const normalizados = {
      ...novosCustos,
      empresaId,
      lojaId: lojaSegura,
    };
    setCustosFixos(normalizados);
    await salvarCustosFixos(normalizados);
  }

  async function recalcularAgora() {
    const response = await fetch("/api/precificacao/recalcular", {
      body: JSON.stringify({ empresaId, lojaId: lojaSegura }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Nao foi possivel recalcular a precificacao.");
    }

    await carregar();
  }

  return {
    alertas,
    canConfigure,
    canRecalculate,
    canReport,
    canSeeMoney,
    canUseFullModule,
    custosFixos,
    custosVariaveis,
    error,
    kpis,
    loading,
    metas,
    plan,
    receitas: receitasCalculadas,
    recalcularAgora,
    refetch: carregar,
    role,
    empresaId,
    insumos,
    lojaId: lojaSegura,
    salvarCustos,
    salvarReceita,
    setCustosFixos,
    setCustosVariaveis,
    setMetas,
  };
}
