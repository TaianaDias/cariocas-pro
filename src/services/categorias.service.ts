import type { Categoria } from "../types";
import { atualizarDocumento, criarDocumento, deletarDocumento, obterDocumento, obterTodos } from "./db";

const COLECAO = "categorias";

type FiltrosCategorias = {
  empresaId?: string;
};

export async function listarCategorias(filtros?: FiltrosCategorias): Promise<Categoria[]> {
  try {
    const caminho = filtros?.empresaId ? `empresas/${filtros.empresaId}/categoriasEstoque` : COLECAO;
    return obterTodos<Categoria>(caminho);
  } catch (error) {
    console.error("Erro ao listar categorias", error);
    return [];
  }
}

export async function getCategoria(id: string): Promise<Categoria | null> {
  try {
    return obterDocumento<Categoria>(COLECAO, id);
  } catch (error) {
    console.error("Erro ao buscar categoria", error);
    return null;
  }
}

export const buscarCategoria = getCategoria;

export async function criarCategoria(dados: Omit<Categoria, "id" | "criadoEm">): Promise<string> {
  try {
    return criarDocumento(COLECAO, dados);
  } catch (error) {
    console.error("Erro ao criar categoria", error);
    throw error;
  }
}

export async function atualizarCategoria(id: string, dados: Partial<Categoria>): Promise<void> {
  try {
    return atualizarDocumento<Categoria>(COLECAO, id, dados);
  } catch (error) {
    console.error("Erro ao atualizar categoria", error);
    throw error;
  }
}

export async function deletarCategoria(id: string): Promise<void> {
  try {
    return deletarDocumento(COLECAO, id);
  } catch (error) {
    console.error("Erro ao deletar categoria", error);
    throw error;
  }
}

export const removerCategoria = deletarCategoria;
