import type { Alerta } from "../types";
import { atualizarDocumento, consultar, criarDocumento, ouvirColecao } from "./db";

const COLECAO = "notificacoes";
export type Notificacao = Alerta;

export function ouvirNotificacoes(uid: string, callback: (notificacoes: Alerta[]) => void): () => void {
  try {
    return ouvirColecao<Alerta>(`${COLECAO}/${uid}/itens`, callback, [], { campo: "criadoEm", direcao: "desc" });
  } catch (error) {
    console.error("Erro ao ouvir notificacoes", error);
    return () => undefined;
  }
}

export async function listarNotificacoes(uid?: string): Promise<Notificacao[]> {
  try {
    return uid
      ? consultar<Notificacao>(`${COLECAO}/${uid}/itens`, [], { campo: "criadoEm", direcao: "desc" })
      : consultar<Notificacao>(COLECAO, [], { campo: "criadoEm", direcao: "desc" });
  } catch (error) {
    console.error("Erro ao listar notificacoes", error);
    return [];
  }
}

export async function listarNotificacoesNaoLidas(uid?: string): Promise<Notificacao[]> {
  try {
    const caminho = uid ? `${COLECAO}/${uid}/itens` : COLECAO;
    return consultar<Notificacao>(caminho, [{ campo: "lido", operador: "==" as const, valor: false }], { campo: "criadoEm", direcao: "desc" });
  } catch (error) {
    console.error("Erro ao listar notificacoes nao lidas", error);
    return [];
  }
}

export async function criarNotificacao(uid: string, dados: Omit<Alerta, "id" | "criadoEm">): Promise<string> {
  try {
    return criarDocumento(`${COLECAO}/${uid}/itens`, dados);
  } catch (error) {
    console.error("Erro ao criar notificacao", error);
    throw error;
  }
}

export async function marcarNotificacaoLida(uid: string, notificacaoId: string): Promise<void> {
  try {
    return atualizarDocumento<Alerta>(`${COLECAO}/${uid}/itens`, notificacaoId, { lido: true });
  } catch (error) {
    console.error("Erro ao marcar notificacao como lida", error);
    throw error;
  }
}

export const marcarNotificacaoComoLida = marcarNotificacaoLida;

export async function limparNotificacoes(uid: string, apenasLidas = true): Promise<void> {
  try {
    console.info("limparNotificacoes sera implementado quando necessario", { uid, apenasLidas });
  } catch (error) {
    console.error("Erro ao limpar notificacoes", error);
  }
}
