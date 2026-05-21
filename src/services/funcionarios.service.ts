import type { Funcionario } from "../types";
import { atualizarDocumento, criarDocumento, deletarDocumento, obterDocumento, obterTodos } from "./db";

const COLECAO = "funcionarios";

export async function listarFuncionarios(): Promise<Funcionario[]> {
  try {
    return obterTodos<Funcionario>(COLECAO);
  } catch (error) {
    console.error("Erro ao listar funcionarios", error);
    return [];
  }
}

export async function getFuncionario(id: string): Promise<Funcionario | null> {
  try {
    return obterDocumento<Funcionario>(COLECAO, id);
  } catch (error) {
    console.error("Erro ao buscar funcionario", error);
    return null;
  }
}

export const buscarFuncionario = getFuncionario;

export async function criarFuncionario(dados: Omit<Funcionario, "id" | "criadoEm">): Promise<string> {
  try {
    return criarDocumento(COLECAO, dados);
  } catch (error) {
    console.error("Erro ao criar funcionario", error);
    throw error;
  }
}

export async function atualizarFuncionario(id: string, dados: Partial<Funcionario>): Promise<void> {
  try {
    return atualizarDocumento<Funcionario>(COLECAO, id, dados);
  } catch (error) {
    console.error("Erro ao atualizar funcionario", error);
    throw error;
  }
}

export async function deletarFuncionario(id: string): Promise<void> {
  try {
    return deletarDocumento(COLECAO, id);
  } catch (error) {
    console.error("Erro ao deletar funcionario", error);
    throw error;
  }
}

export const removerFuncionario = deletarFuncionario;

export async function getFuncionariosAtivos(): Promise<Funcionario[]> {
  try {
    const todos = await listarFuncionarios();
    return todos.filter((item) => item.ativo);
  } catch (error) {
    console.error("Erro ao listar funcionarios ativos", error);
    return [];
  }
}
