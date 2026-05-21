import type { Automacao } from "../types";
import { atualizarDocumento, criarDocumento, deletarDocumento, obterDocumento, obterTodos } from "./db";

const COLECAO = "automacoes";

export async function listarAutomacoes(): Promise<Automacao[]> {
  try {
    return obterTodos<Automacao>(COLECAO);
  } catch (error) {
    console.error("Erro ao listar automacoes", error);
    return [];
  }
}

export async function getAutomacao(id: string): Promise<Automacao | null> {
  try {
    return obterDocumento<Automacao>(COLECAO, id);
  } catch (error) {
    console.error("Erro ao buscar automacao", error);
    return null;
  }
}

export const buscarAutomacao = getAutomacao;

export async function criarAutomacao(dados: Omit<Automacao, "id" | "criadoEm" | "atualizadoEm">): Promise<string> {
  try {
    return criarDocumento(COLECAO, dados);
  } catch (error) {
    console.error("Erro ao criar automacao", error);
    throw error;
  }
}

export async function atualizarAutomacao(id: string, dados: Partial<Automacao>): Promise<void> {
  try {
    return atualizarDocumento<Automacao>(COLECAO, id, dados);
  } catch (error) {
    console.error("Erro ao atualizar automacao", error);
    throw error;
  }
}

export function ativarAutomacao(id: string): Promise<void> {
  return atualizarAutomacao(id, { ativo: true });
}

export function desativarAutomacao(id: string): Promise<void> {
  return atualizarAutomacao(id, { ativo: false });
}

export async function deletarAutomacao(id: string): Promise<void> {
  try {
    return deletarDocumento(COLECAO, id);
  } catch (error) {
    console.error("Erro ao deletar automacao", error);
    throw error;
  }
}

export const removerAutomacao = deletarAutomacao;
