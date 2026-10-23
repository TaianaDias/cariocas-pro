"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { canAccessPrecificacao, canSeePrecificacaoMoney, canUsePrecificacaoCompleta, hasPrecificacaoPermission } from "../lib/permissions";
import {
  atualizarIngredientesComEstoque,
  custosFixosPadrao,
  custosVariaveisPadrao,
  gerarAlertasFinanceiros,
  mascararReceitaPrecificacao,
  metasPadrao,
  recalcularReceita,
  salvarCustosFixos,
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
import { authenticatedFetch } from "../lib/authenticated-fetch";

export function usePrecificacao() {
  const { loading: authLoading, user, userProfile } = useAuth();
  const plan = userProfile?.plano ?? userProfile?.plan ?? "free";
  const role = userProfile?.role ?? "user";
  const empresaId = userProfile?.empresaId || "";
  const lojaId = userProfile?.lojaId;
  const lojaSegura = lojaId || "";
  const pendente = useRef<{ assinatura: string; id: string } | null>(null);
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

  const canAccessModule = canAccessPrecificacao(plan, role);
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
      return { cmvMedio: null, criticas: 0, custoTotal: null, lucroTotal: null, margemMedia: null, maisLucrativa: undefined, piorCmv: undefined, fichasNaMedia: 0, totalFichas: 0 };
    }

    const validas = receitasCalculadas.filter((item) => item.custoSituacao !== "pendente" && item.cmv !== null && item.margem !== null);
    const total = validas.length || 1;
    const lucroTotal = validas.reduce((acc, item) => acc + (item.lucro ?? 0), 0);
    const custoTotal = validas.reduce((acc, item) => acc + (item.custoTotalReal ?? 0), 0);
    const margemMedia = validas.length ? validas.reduce((acc, item) => acc + (item.margem ?? 0), 0) / total : null;
    const cmvMedio = validas.length ? validas.reduce((acc, item) => acc + (item.cmv ?? 0), 0) / total : null;
    const criticas = receitasCalculadas.filter((item) => item.status === "critico").length;
    const maisLucrativa = [...validas].sort((a, b) => (b.lucro ?? 0) - (a.lucro ?? 0))[0];
    const piorCmv = [...validas].sort((a, b) => (b.cmv ?? 0) - (a.cmv ?? 0))[0];

    return { cmvMedio, criticas, custoTotal: validas.length ? custoTotal : null, lucroTotal: validas.length ? lucroTotal : null, margemMedia, maisLucrativa, piorCmv, fichasNaMedia: validas.length, totalFichas: receitasCalculadas.length };
  }, [canSeeMoney, receitasCalculadas]);

  const alertas = useMemo(
    () => (canSeeMoney ? gerarAlertasFinanceiros(receitasCalculadas, metas) : []),
    [canSeeMoney, metas, receitasCalculadas],
  );

  const carregar = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);

    try {
      if (!user || !empresaId || !lojaSegura) throw new Error("Aguarde a sessão e o perfil com empresa e loja definidos.");
      if (!canAccessModule) {
        setInsumos([]);
        setReceitas([]);
        setError(null);
        return;
      }

      if (!canSeeMoney) {
        const insumosData = await listarInsumos({ empresaId, lojaId: lojaSegura });
        setInsumos(insumosData);
        setReceitas([]);
        setError(null);
        return;
      }

      const response = await authenticatedFetch(user, "/api/precificacao/catalogo", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o catálogo.");
      setReceitas(data.receitas);
      setInsumos(data.insumos);
      setCustosFixos(data.custosFixos);
      setCustosVariaveis(data.custosVariaveis);
      setMetas(data.metas);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar precificação.");
    } finally {
      setLoading(false);
    }
  }, [authLoading, user, canAccessModule, canSeeMoney, empresaId, lojaSegura]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function mutar(dados: Record<string, unknown>) {
    if (!canConfigure || !user) throw new Error("Seu perfil ou plano não permite esta ação.");
    const assinatura = JSON.stringify(dados);
    if (pendente.current?.assinatura !== assinatura) pendente.current = { assinatura, id: crypto.randomUUID() };
    const response = await authenticatedFetch(user, "/api/precificacao/catalogo", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...dados, operacaoId: pendente.current!.id }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível salvar. Tente novamente.");
    pendente.current = null;
    await carregar();
    return data as { id: string; versao: number };
  }

  async function criarInsumoFicha(dados: { nome: string; unidadeCompra: string; unidadeUso: string; fatorConversao: number; custoEstimado: number | null }) {
    return mutar({ acao: "criarInsumo", ...dados });
  }

  async function atualizarReferencia(insumo: Insumo, custoEstimado: number | null, versaoEsperada = insumo.custoReferencia?.versao || 0) {
    return mutar({ acao: "atualizarCusto", insumoId: insumo.id, versaoCusto: versaoEsperada, custoEstimado });
  }

  async function salvarReceita(receita: Partial<ReceitaPrecificacao>) {
    return mutar({
      acao: "salvarFicha", id: receita.id, versaoFicha: receita.versaoFicha || 0,
      nome: receita.nome, categoria: receita.categoria || "Hamburguer", descricao: receita.descricao || "",
      modoPreparo: receita.modoPreparo || "", imagemUrl: receita.imagemUrl || "", observacoesInternas: receita.observacoesInternas || "",
      precoVenda: receita.precoVenda, margemDesejada: receita.margemDesejada ?? 35,
      ativa: receita.ativa ?? true, ingrediente: receita.ingrediente ?? false, fracionado: receita.fracionado ?? false,
      ingredientes: (receita.ingredientes || []).map(({ insumoId, quantidade, unidade, tipo }) => ({ insumoId, quantidade, unidade, tipo })),
    });
  }

  async function salvarCustos(novosCustos: CustosFixosPrecificacao) {
    if (!canConfigure) {
      throw new Error("Seu perfil ou plano não permite alterar custos da precificação.");
    }

    const normalizados = {
      ...novosCustos,
      empresaId,
      lojaId: lojaSegura,
    };
    setCustosFixos(normalizados);
    await salvarCustosFixos(normalizados);
  }

  async function recalcularAgora() {
    if (!canRecalculate) {
      throw new Error("Seu perfil ou plano não permite recalcular a precificação.");
    }

    if (!user) {
      throw new Error("Sessão não encontrada. Entre novamente para recalcular a precificação.");
    }

    const token = await user.getIdToken();
    const response = await fetch("/api/precificacao/recalcular", {
      body: JSON.stringify({ empresaId, lojaId: lojaSegura }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "Não foi possível recalcular a precificação.");
    }

    await carregar();
  }

  return {
    alertas,
    canAccessModule,
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
    criarInsumoFicha,
    atualizarReferencia,
    lojaId: lojaSegura,
    salvarCustos,
    salvarReceita,
    setCustosFixos,
    setCustosVariaveis,
    setMetas,
  };
}
