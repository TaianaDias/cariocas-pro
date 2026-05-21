import type { Desperdicio } from "../types";
import { consultar, criarDocumento, deletarDocumento, obterDocumento, atualizarDocumento } from "./db";

const COLECAO = "desperdicio";

export async function listarDesperdicios(dataInicio?: Date, dataFim?: Date): Promise<Desperdicio[]> {
  try {
    const filtros = [
      ...(dataInicio ? [{ campo: "data", operador: ">=" as const, valor: dataInicio }] : []),
      ...(dataFim ? [{ campo: "data", operador: "<=" as const, valor: dataFim }] : []),
    ];
    return consultar<Desperdicio>(COLECAO, filtros, { campo: "data", direcao: "desc" });
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
    return criarDocumento(COLECAO, dados);
  } catch (error) {
    console.error("Erro ao registrar desperdicio", error);
    throw error;
  }
}

export const criarDesperdicio = registrarDesperdicio;

export function atualizarDesperdicio(id: string, dados: Partial<Desperdicio>): Promise<void> {
  return atualizarDocumento<Desperdicio>(COLECAO, id, dados);
}

export function removerDesperdicio(id: string): Promise<void> {
  return deletarDocumento(COLECAO, id);
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
