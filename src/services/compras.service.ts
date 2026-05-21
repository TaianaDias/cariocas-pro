import type { PedidoCompra } from "../types";
import { atualizarDocumento, consultar, criarDocumento, deletarDocumento, obterDocumento } from "./db";

const COLECAO = "pedidos_compra";

export async function listarPedidos(): Promise<PedidoCompra[]> {
  try {
    return consultar<PedidoCompra>(COLECAO, [], { campo: "criadoEm", direcao: "desc" });
  } catch (error) {
    console.error("Erro ao listar pedidos", error);
    return [];
  }
}

export const listarPedidosCompra = listarPedidos;

export async function getPedido(id: string): Promise<PedidoCompra | null> {
  try {
    return obterDocumento<PedidoCompra>(COLECAO, id);
  } catch (error) {
    console.error("Erro ao buscar pedido", error);
    return null;
  }
}

export const buscarPedidoCompra = getPedido;

export async function criarPedido(dados: Omit<PedidoCompra, "id" | "createdBy" | "criadoEm" | "atualizadoEm">, uid: string): Promise<string> {
  try {
    return criarDocumento(COLECAO, { ...dados, createdBy: uid });
  } catch (error) {
    console.error("Erro ao criar pedido", error);
    throw error;
  }
}

export const criarPedidoCompra = criarPedido;

export async function atualizarPedido(id: string, dados: Partial<PedidoCompra>): Promise<void> {
  try {
    return atualizarDocumento<PedidoCompra>(COLECAO, id, dados);
  } catch (error) {
    console.error("Erro ao atualizar pedido", error);
    throw error;
  }
}

export const atualizarPedidoCompra = atualizarPedido;

export async function deletarPedido(id: string): Promise<void> {
  try {
    return deletarDocumento(COLECAO, id);
  } catch (error) {
    console.error("Erro ao deletar pedido", error);
    throw error;
  }
}

export const removerPedidoCompra = deletarPedido;

export async function getPedidosPorFornecedor(fornecedorId: string): Promise<PedidoCompra[]> {
  try {
    return consultar<PedidoCompra>(COLECAO, [{ campo: "fornecedorId", operador: "==" as const, valor: fornecedorId }], { campo: "criadoEm", direcao: "desc" });
  } catch (error) {
    console.error("Erro ao listar pedidos por fornecedor", error);
    return [];
  }
}
