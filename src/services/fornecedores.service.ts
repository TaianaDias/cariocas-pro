import type { Fornecedor, FornecedorVinculo } from "../types";
import { atualizarDocumento, batchEscrita, consultar, criarDocumento, deletarDocumento, obterDocumento, obterTodos } from "./db";

const COLECAO = "fornecedores";

export async function listarFornecedores(): Promise<Fornecedor[]> {
  try {
    return obterTodos<Fornecedor>(COLECAO);
  } catch (error) {
    console.error("Erro ao listar fornecedores", error);
    return [];
  }
}

export async function getFornecedor(id: string): Promise<Fornecedor | null> {
  try {
    return obterDocumento<Fornecedor>(COLECAO, id);
  } catch (error) {
    console.error("Erro ao buscar fornecedor", error);
    return null;
  }
}

export const buscarFornecedor = getFornecedor;

export async function criarFornecedor(dados: Omit<Fornecedor, "id" | "criadoEm" | "atualizadoEm">): Promise<string> {
  try {
    return criarDocumento(COLECAO, dados);
  } catch (error) {
    console.error("Erro ao criar fornecedor", error);
    throw error;
  }
}

export async function atualizarFornecedor(id: string, dados: Partial<Fornecedor>): Promise<void> {
  try {
    return atualizarDocumento<Fornecedor>(COLECAO, id, dados);
  } catch (error) {
    console.error("Erro ao atualizar fornecedor", error);
    throw error;
  }
}

export async function deletarFornecedor(id: string): Promise<void> {
  try {
    return deletarDocumento(COLECAO, id);
  } catch (error) {
    console.error("Erro ao deletar fornecedor", error);
    throw error;
  }
}

export const removerFornecedor = deletarFornecedor;

export async function searchFornecedores(busca: string): Promise<Fornecedor[]> {
  try {
    const termo = busca.toLowerCase();
    const todos = await obterTodos<Fornecedor>(COLECAO);
    return todos.filter((item) => item.nome.toLowerCase().includes(termo) || item.cnpj.includes(termo));
  } catch (error) {
    console.error("Erro ao buscar fornecedores", error);
    return [];
  }
}

export async function listarProdutosDoFornecedor(fornecedorId: string): Promise<(FornecedorVinculo & { id?: string; insumoId?: string; insumoNome?: string })[]> {
  try {
    return consultar(`${COLECAO}/${fornecedorId}/produtos`, [], { campo: "insumoNome", direcao: "asc" });
  } catch (error) {
    console.error("Erro ao listar produtos do fornecedor", error);
    return [];
  }
}

export async function vincularProdutoAoFornecedor(fornecedorId: string, vinculo: FornecedorVinculo): Promise<void> {
  try {
    if (vinculo.principal) {
      const existentes = await listarProdutosDoFornecedor(fornecedorId);
      const operacoes = existentes
        .filter((item) => item.principal && item.id && item.fornecedorId !== vinculo.fornecedorId)
        .map((item) => ({
          tipo: "update" as const,
          caminho: `${COLECAO}/${fornecedorId}/produtos`,
          docId: item.id!,
          dados: { principal: false },
        }));

      if (operacoes.length > 0) {
        await batchEscrita(operacoes);
      }
    }

    await criarDocumento(`${COLECAO}/${fornecedorId}/produtos`, {
      ...vinculo,
      insumoId: vinculo.fornecedorId,
      insumoNome: vinculo.fornecedorNome,
    });
  } catch (error) {
    console.error("Erro ao vincular produto ao fornecedor", error);
    throw error;
  }
}

export async function desvincularProduto(fornecedorId: string, produtoId: string): Promise<void> {
  try {
    return deletarDocumento(`${COLECAO}/${fornecedorId}/produtos`, produtoId);
  } catch (error) {
    console.error("Erro ao desvincular produto", error);
    throw error;
  }
}
