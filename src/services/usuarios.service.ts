import type { Usuario } from "../types";
import { atualizarDocumento, criarDocumento, obterDocumento, obterTodos } from "./db";

const COLECAO = "usuarios";

export async function listarUsuarios(): Promise<Usuario[]> {
  try {
    return obterTodos<Usuario>(COLECAO);
  } catch (error) {
    console.error("Erro ao listar usuarios", error);
    return [];
  }
}

export async function getPerfil(uid: string): Promise<Usuario | null> {
  try {
    return obterDocumento<Usuario>(COLECAO, uid);
  } catch (error) {
    console.error("Erro ao buscar perfil", error);
    return null;
  }
}

export const buscarUsuario = getPerfil;

export async function criarPerfil(dados: Omit<Usuario, "criadoEm" | "ultimoAcesso">): Promise<void> {
  try {
    await criarDocumento(COLECAO, dados, dados.uid);
  } catch (error) {
    console.error("Erro ao criar perfil", error);
    throw error;
  }
}

export const salvarUsuario = criarPerfil;

export async function atualizarPerfil(uid: string, dados: Partial<Usuario>): Promise<void> {
  try {
    return atualizarDocumento<Usuario>(COLECAO, uid, dados);
  } catch (error) {
    console.error("Erro ao atualizar perfil", error);
    throw error;
  }
}

export const atualizarUsuario = atualizarPerfil;

export async function atualizarPlano(uid: string, plano: Usuario["plano"]): Promise<void> {
  try {
    return atualizarDocumento<Usuario>(COLECAO, uid, {
      plan: plano,
      plano,
      updatedAt: new Date(),
    } as Partial<Usuario>);
  } catch (error) {
    console.error("Erro ao atualizar plano", error);
    throw error;
  }
}

export async function registrarAcesso(uid: string): Promise<void> {
  try {
    return atualizarDocumento<Usuario>(COLECAO, uid, { ultimoAcesso: new Date() });
  } catch (error) {
    console.error("Erro ao registrar acesso", error);
    throw error;
  }
}
