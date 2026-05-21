import type { Historico } from "../types";
import { consultar, criarDocumento, obterDocumento } from "./db";

const COLECAO = "historico";

type FiltrosHistorico = {
  insumoId?: string;
  tipo?: string;
  dataInicio?: Date;
  dataFim?: Date;
};

export async function listarHistorico(filtros?: FiltrosHistorico, limite?: number): Promise<Historico[]> {
  try {
    const filtrosArray = [
      ...(filtros?.insumoId ? [{ campo: "insumoId", operador: "==" as const, valor: filtros.insumoId }] : []),
      ...(filtros?.tipo ? [{ campo: "tipo", operador: "==" as const, valor: filtros.tipo }] : []),
      ...(filtros?.dataInicio ? [{ campo: "criadoEm", operador: ">=" as const, valor: filtros.dataInicio }] : []),
      ...(filtros?.dataFim ? [{ campo: "criadoEm", operador: "<=" as const, valor: filtros.dataFim }] : []),
    ];

    return consultar<Historico>(COLECAO, filtrosArray, { campo: "criadoEm", direcao: "desc" }, limite);
  } catch (error) {
    console.error("Erro ao listar historico", error);
    return [];
  }
}

export async function registrarHistorico(dados: Omit<Historico, "id" | "criadoEm">): Promise<string> {
  try {
    return criarDocumento(COLECAO, dados);
  } catch (error) {
    console.error("Erro ao registrar historico", error);
    throw error;
  }
}

export async function buscarHistorico(id: string): Promise<Historico | null> {
  try {
    return obterDocumento<Historico>(COLECAO, id);
  } catch (error) {
    console.error("Erro ao buscar historico", error);
    return null;
  }
}

export async function getHistoricoPorInsumo(insumoId: string): Promise<Historico[]> {
  return listarHistorico({ insumoId });
}

export async function getUltimosEventos(limite = 20): Promise<Historico[]> {
  return listarHistorico(undefined, limite);
}

export const criarHistorico = registrarHistorico;
export const listarHistoricoPorInsumo = getHistoricoPorInsumo;
