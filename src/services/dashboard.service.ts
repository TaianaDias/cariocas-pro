import type { CmvForaIdeal, CompraRecomendada, DashboardKpis, Desperdicio, Insumo, ProdutoVencimento, Ruptura } from "../types";
import { obterTodos } from "./db";
import { listarInsumos } from "./estoque.service";

type TenantContext = {
  empresaId?: string;
  lojaId?: string;
};

async function listarInsumosDashboard(context?: TenantContext) {
  if (context?.empresaId) return listarInsumos({ empresaId: context.empresaId, lojaId: context.lojaId });
  return obterTodos<Insumo>("insumos");
}

export async function getKpis(context?: TenantContext): Promise<DashboardKpis> {
  try {
    const todos = await listarInsumosDashboard(context);
    const desperdicios = context?.empresaId ? await obterTodos<Desperdicio>(`empresas/${context.empresaId}/desperdicios`) : [];
    const custoDoDia = todos.reduce((acc, item) => acc + (item.quantidadeAtual > 0 ? item.custoCompra * item.quantidadeAtual : 0), 0);
    const itensCriticos = todos.filter((item) => item.quantidadeAtual <= item.estoqueMinimo).length;
    const reposicaoPendente = todos.filter((item) => item.quantidadeAtual <= 0).length;
    const itensParados = todos.filter((item) => item.status === "parado" || item.status === "pausado").length;
    const custoDesperdicio = desperdicios
      .filter((item) => !context?.lojaId || item.lojaId === context.lojaId)
      .reduce((acc, item) => acc + (Number(item.custoEstimado) || 0), 0);
    const desperdicioPercentual = custoDoDia > 0 ? (custoDesperdicio / custoDoDia) * 100 : todos.length > 0 ? (itensParados / todos.length) * 100 : 0;

    return {
      custoDoDia: Math.round(custoDoDia * 100) / 100,
      variacaoCusto: -3.1,
      desperdicioPercentual: Math.round(desperdicioPercentual * 10) / 10,
      variacaoDesperdicio: 1.2,
      itensCriticos,
      reposicaoPendente,
    };
  } catch (error) {
    console.error("Erro ao buscar KPIs", error);
    return { custoDoDia: 0, variacaoCusto: 0, desperdicioPercentual: 0, variacaoDesperdicio: 0, itensCriticos: 0, reposicaoPendente: 0 };
  }
}

export const buscarDashboardKpis = getKpis;

export async function getProdutosAVencer(dias = 3, context?: TenantContext): Promise<ProdutoVencimento[]> {
  try {
    const todos = await listarInsumosDashboard(context);
    return todos
      .filter((item) => item.validadeOriginal > 0)
      .map((insumo) => ({ insumo, diasRestantes: insumo.validadeOriginal }))
      .filter((item) => item.diasRestantes <= dias && item.diasRestantes > 0)
      .sort((a, b) => a.diasRestantes - b.diasRestantes)
      .slice(0, 5);
  } catch (error) {
    console.error("Erro ao buscar produtos a vencer", error);
    return [];
  }
}

export const listarProdutosAVencer = getProdutosAVencer;

export async function getPrevisaoRuptura(context?: TenantContext): Promise<Ruptura[]> {
  try {
    const todos = await listarInsumosDashboard(context);
    return todos
      .filter((item) => item.quantidadeAtual <= item.estoqueMinimo && item.quantidadeAtual > 0)
      .map((insumo) => ({
        insumo,
        probabilidade: Math.round((1 - insumo.quantidadeAtual / (insumo.estoqueMinimo || 1)) * 100),
        previsaoDias: Math.max(1, Math.round(insumo.quantidadeAtual / 2)),
      }))
      .sort((a, b) => b.probabilidade - a.probabilidade)
      .slice(0, 5);
  } catch (error) {
    console.error("Erro ao buscar previsao de ruptura", error);
    return [];
  }
}

export const listarRupturas = getPrevisaoRuptura;

export async function getComprasRecomendadas(context?: TenantContext): Promise<CompraRecomendada[]> {
  try {
    const todos = await listarInsumosDashboard(context);
    return todos
      .filter((item) => item.quantidadeAtual <= item.estoqueMinimo && item.estoqueMinimo > 0)
      .map((insumo) => ({
        insumo,
        quantidadeRecomendada: insumo.estoqueMaximo - insumo.quantidadeAtual,
        custoEstimado: Math.round((insumo.estoqueMaximo - insumo.quantidadeAtual) * insumo.custoCompra * 100) / 100,
      }))
      .filter((item) => item.quantidadeRecomendada > 0)
      .sort((a, b) => b.custoEstimado - a.custoEstimado)
      .slice(0, 5);
  } catch (error) {
    console.error("Erro ao buscar compras recomendadas", error);
    return [];
  }
}

export const listarComprasRecomendadas = getComprasRecomendadas;

export async function getCmvForaIdeal(context?: TenantContext): Promise<CmvForaIdeal[]> {
  try {
    const todos = await listarInsumosDashboard(context);
    return todos
      .filter((item) => item.cmv > 0 && item.margemEstimada > 0)
      .map((insumo) => ({
        insumo,
        cmvAtual: insumo.cmv,
        cmvIdeal: 100 - insumo.margemEstimada,
        variacao: Math.round((insumo.cmv - (100 - insumo.margemEstimada)) * 10) / 10,
      }))
      .filter((item) => item.variacao > 5)
      .sort((a, b) => b.variacao - a.variacao)
      .slice(0, 5);
  } catch (error) {
    console.error("Erro ao buscar CMV fora do ideal", error);
    return [];
  }
}

export const listarCmvForaIdeal = getCmvForaIdeal;
