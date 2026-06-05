import type { Funcionario } from "../types";
import { atualizarDocumento, consultar, criarDocumento, deletarDocumento, obterDocumento, obterTodos } from "./db";

const COLECAO = "funcionarios";
const COLECAO_USUARIOS = "usuarios";

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
    const id = await criarDocumento(COLECAO, dados);
    await sincronizarUsuarioFuncionario(dados);
    return id;
  } catch (error) {
    console.error("Erro ao criar funcionario", error);
    throw error;
  }
}

export async function atualizarFuncionario(id: string, dados: Partial<Funcionario>): Promise<void> {
  try {
    await atualizarDocumento<Funcionario>(COLECAO, id, dados);
    const funcionario = await obterDocumento<Funcionario>(COLECAO, id);
    if (funcionario) {
      await sincronizarUsuarioFuncionario(funcionario);
    }
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

async function sincronizarUsuarioFuncionario(funcionario: Partial<Funcionario>) {
  const email = funcionario.email?.trim().toLowerCase();
  if (!email) return;

  const usuarios = await consultar<{ uid: string }>(COLECAO_USUARIOS, [{ campo: "email", operador: "==", valor: email }]);
  await Promise.all(
    usuarios
      .filter((usuario) => usuario.uid)
      .map((usuario) =>
        atualizarDocumento(COLECAO_USUARIOS, usuario.uid, {
          nome: funcionario.nome,
          role: funcionario.role || "funcionario",
          funcionarioAtivo: Boolean(funcionario.ativo),
          permissoes: funcionario.ativo === false ? [] : funcionario.permissoes || [],
        }),
      ),
  );
}
