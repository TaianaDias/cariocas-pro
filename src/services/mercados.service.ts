import type { Mercado } from "../types";
import { criarDocumento, obterTodos } from "./db";

const COLECAO = "mercados";

export async function listarMercados(): Promise<Mercado[]> {
  try {
    return obterTodos<Mercado>(COLECAO);
  } catch (error) {
    console.error("Erro ao listar mercados", error);
    return [];
  }
}

export async function criarMercado(dados: Omit<Mercado, "id" | "criadoEm" | "atualizadoEm">): Promise<string> {
  try {
    return criarDocumento(COLECAO, dados);
  } catch (error) {
    console.error("Erro ao criar mercado", error);
    throw error;
  }
}
