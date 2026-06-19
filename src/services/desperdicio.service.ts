import type { Desperdicio, Insumo } from "../types";
import { consultar, criarDocumento, deletarDocumento, obterDocumento, atualizarDocumento } from "./db";
import { getHistoricoEstoqueCollectionPath, getInsumosCollectionPath, normalizarInsumoFinanceiro } from "./estoque.service";

const COLECAO = "desperdicio";

type TenantContext = {
  empresaId?: string;
  lojaId?: string;
};

function getDesperdiciosCollectionPath(empresaId?: string) {
  return empresaId ? `empresas/${empresaId}/desperdicios` : COLECAO;
}

export async function listarDesperdicios(dataInicio?: Date, dataFim?: Date, context?: TenantContext): Promise<Desperdicio[]> {
  try {
    const filtros = [
      ...(context?.lojaId ? [{ campo: "lojaId", operador: "==" as const, valor: context.lojaId }] : []),
      ...(dataInicio ? [{ campo: "data", operador: ">=" as const, valor: dataInicio }] : []),
      ...(dataFim ? [{ campo: "data", operador: "<=" as const, valor: dataFim }] : []),
    ];
    return consultar<Desperdicio>(getDesperdiciosCollectionPath(context?.empresaId), filtros, { campo: "data", direcao: "desc" });
  } catch (error) {
    console.error("Erro ao listar desperdicios", error);
    return [];
  }
}

export async function buscarDesperdicio(id: string): Promise<Desperdicio | null> {
  try {
    return obterDocumento<Desperdicio>(COLECAO, id);
  } catch (error) {
    console.error("Erro ao buscar desperdicio", error);
    return null;
  }
}

export async function registrarDesperdicio(dados: Omit<Desperdicio, "id" | "criadoEm">): Promise<string> {
  try {
    if (!dados.empresaId || !dados.lojaId) throw new Error("empresaId e lojaId sao obrigatorios para registrar desperdicio.");
    if (!dados.insumoId) throw new Error("Selecione o insumo do desperdicio.");
    if (dados.quantidade <= 0) throw new Error("Quantidade precisa ser maior que zero.");

    const insumo = await obterDocumento<Insumo>(getInsumosCollectionPath(dados.empresaId), dados.insumoId);
    if (!insumo) throw new Error("Insumo nao encontrado.");
    if (insumo.lojaId && insumo.lojaId !== dados.lojaId) throw new Error("Insumo pertence a outra loja.");

    const estoqueAtual = Number(insumo.estoqueAtual ?? insumo.quantidadeAtual) || 0;
    if (estoqueAtual < dados.quantidade) throw new Error("Estoque insuficiente para registrar o desperdicio.");

    const custoUnitarioUso = Number(insumo.custoUnitarioUso ?? insumo.custoUnitario ?? insumo.custoCompra) || 0;
    const custoEstimado = Math.round(dados.quantidade * custoUnitarioUso * 100) / 100;
    const novoEstoque = estoqueAtual - dados.quantidade;

    await atualizarDocumento<Insumo>(getInsumosCollectionPath(dados.empresaId), dados.insumoId, normalizarInsumoFinanceiro({
      ...insumo,
      estoqueAtual: novoEstoque,
      quantidadeAtual: novoEstoque,
    }));

    const id = await criarDocumento(getDesperdiciosCollectionPath(dados.empresaId), {
      ...dados,
      custoEstimado,
      insumoNome: dados.insumoNome || insumo.nome,
    });

    await criarDocumento(getHistoricoEstoqueCollectionPath(dados.empresaId), {
      data: dados.data || new Date(),
      empresaId: dados.empresaId,
      lojaId: dados.lojaId,
      insumoId: dados.insumoId,
      insumoNome: dados.insumoNome || insumo.nome,
      quantidade: -dados.quantidade,
      custoUnitario: custoUnitarioUso,
      custoTotal: custoEstimado,
      motivo: dados.motivo,
      observacao: `Desperdicio: ${dados.motivo}`,
      responsavel: dados.responsavel,
      usuarioId: dados.colaboradorId || dados.responsavel,
      tipo: "desperdicio",
      tipoMovimentacao: "desperdicio",
    });

    return id;
  } catch (error) {
    console.error("Erro ao registrar desperdicio", error);
    throw error;
  }
}

export const criarDesperdicio = registrarDesperdicio;

export function atualizarDesperdicio(id: string, dados: Partial<Desperdicio>): Promise<void> {
  return atualizarDocumento<Desperdicio>(getDesperdiciosCollectionPath(dados.empresaId), id, dados);
}

export function removerDesperdicio(id: string, context?: TenantContext): Promise<void> {
  return deletarDocumento(getDesperdiciosCollectionPath(context?.empresaId), id);
}

export async function getTotalDesperdicioPeriodo(dataInicio: Date, dataFim: Date): Promise<number> {
  try {
    const items = await listarDesperdicios(dataInicio, dataFim);
    return items.reduce((acc, item) => acc + (item.custoEstimado || 0), 0);
  } catch (error) {
    console.error("Erro ao calcular total de desperdicio", error);
    return 0;
  }
}

export async function getDesperdicioPorCategoria(dataInicio: Date, dataFim: Date): Promise<Record<string, number>> {
  try {
    const items = await listarDesperdicios(dataInicio, dataFim);
    const agrupado: Record<string, number> = {};
    for (const item of items) {
      const categoria = item.categoria || "outro";
      agrupado[categoria] = (agrupado[categoria] || 0) + (item.custoEstimado || 0);
    }
    return agrupado;
  } catch (error) {
    console.error("Erro ao agrupar desperdicio por categoria", error);
    return {};
  }
}
