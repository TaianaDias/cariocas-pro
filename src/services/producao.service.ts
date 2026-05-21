import type { FichaTecnica, OrdemProducao } from "../types";
import { atualizarDocumento, consultar, criarDocumento, deletarDocumento, obterDocumento, obterTodos } from "./db";

const COLECAO_FICHAS = "fichas_tecnicas";
const COLECAO_ORDENS = "ordens_producao";

export async function listarFichasTecnicas(): Promise<FichaTecnica[]> {
  try {
    return obterTodos<FichaTecnica>(COLECAO_FICHAS);
  } catch (error) {
    console.error("Erro ao listar fichas tecnicas", error);
    return [];
  }
}

export async function getFichaTecnica(id: string): Promise<FichaTecnica | null> {
  try {
    return obterDocumento<FichaTecnica>(COLECAO_FICHAS, id);
  } catch (error) {
    console.error("Erro ao buscar ficha tecnica", error);
    return null;
  }
}

export const buscarFichaTecnica = getFichaTecnica;

export async function criarFichaTecnica(dados: Omit<FichaTecnica, "id" | "criadoEm" | "atualizadoEm">): Promise<string> {
  try {
    return criarDocumento(COLECAO_FICHAS, dados);
  } catch (error) {
    console.error("Erro ao criar ficha tecnica", error);
    throw error;
  }
}

export async function atualizarFichaTecnica(id: string, dados: Partial<FichaTecnica>): Promise<void> {
  try {
    return atualizarDocumento<FichaTecnica>(COLECAO_FICHAS, id, dados);
  } catch (error) {
    console.error("Erro ao atualizar ficha tecnica", error);
    throw error;
  }
}

export async function deletarFichaTecnica(id: string): Promise<void> {
  try {
    return deletarDocumento(COLECAO_FICHAS, id);
  } catch (error) {
    console.error("Erro ao deletar ficha tecnica", error);
    throw error;
  }
}

export const removerFichaTecnica = deletarFichaTecnica;

export async function listarOrdensProducao(): Promise<OrdemProducao[]> {
  try {
    return consultar<OrdemProducao>(COLECAO_ORDENS, [], { campo: "dataProgramada", direcao: "desc" });
  } catch (error) {
    console.error("Erro ao listar ordens de producao", error);
    return [];
  }
}

export async function getOrdemProducao(id: string): Promise<OrdemProducao | null> {
  try {
    return obterDocumento<OrdemProducao>(COLECAO_ORDENS, id);
  } catch (error) {
    console.error("Erro ao buscar ordem de producao", error);
    return null;
  }
}

export async function criarOrdemProducao(dados: Omit<OrdemProducao, "id" | "criadoEm" | "atualizadoEm">): Promise<string> {
  try {
    return criarDocumento(COLECAO_ORDENS, dados);
  } catch (error) {
    console.error("Erro ao criar ordem de producao", error);
    throw error;
  }
}

export async function atualizarOrdemProducao(id: string, dados: Partial<OrdemProducao>): Promise<void> {
  try {
    return atualizarDocumento<OrdemProducao>(COLECAO_ORDENS, id, dados);
  } catch (error) {
    console.error("Erro ao atualizar ordem de producao", error);
    throw error;
  }
}
