import type { PedidoCompra } from "../types";
import { atualizarDocumento, consultar, criarDocumento, deletarDocumento, obterDocumento } from "./db";
import { getHistoricoEstoqueCollectionPath, getInsumosCollectionPath, normalizarInsumoFinanceiro } from "./estoque.service";
import type { Insumo } from "../types";

const COLECAO = "pedidos_compra";

type TenantContext = {
  empresaId?: string;
  lojaId?: string;
  uid?: string;
};

function getPedidosCollectionPath(empresaId?: string) {
  return empresaId ? `empresas/${empresaId}/pedidosCompra` : COLECAO;
}

export async function listarPedidos(context?: TenantContext): Promise<PedidoCompra[]> {
  try {
    return consultar<PedidoCompra>(
      getPedidosCollectionPath(context?.empresaId),
      [...(context?.lojaId ? [{ campo: "lojaId", operador: "==" as const, valor: context.lojaId }] : [])],
      { campo: "criadoEm", direcao: "desc" },
    );
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
    if (!dados.empresaId || !dados.lojaId) {
      throw new Error("empresaId e lojaId sao obrigatorios para criar pedido de compra.");
    }
    return criarDocumento(getPedidosCollectionPath(dados.empresaId), { ...dados, createdBy: uid });
  } catch (error) {
    console.error("Erro ao criar pedido", error);
    throw error;
  }
}

export const criarPedidoCompra = criarPedido;

export async function atualizarPedido(id: string, dados: Partial<PedidoCompra>): Promise<void> {
  try {
    return atualizarDocumento<PedidoCompra>(getPedidosCollectionPath(dados.empresaId), id, dados);
  } catch (error) {
    console.error("Erro ao atualizar pedido", error);
    throw error;
  }
}

export const atualizarPedidoCompra = atualizarPedido;

export async function deletarPedido(id: string, context?: TenantContext): Promise<void> {
  try {
    return deletarDocumento(getPedidosCollectionPath(context?.empresaId), id);
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

export async function registrarRecebimentoPedido(
  id: string,
  context: Required<TenantContext>,
): Promise<void> {
  try {
    const pedido = await obterDocumento<PedidoCompra>(getPedidosCollectionPath(context.empresaId), id);
    if (!pedido) throw new Error("Pedido de compra nao encontrado.");
    if (pedido.lojaId && pedido.lojaId !== context.lojaId) throw new Error("Pedido pertence a outra loja.");
    if (pedido.status === "recebido") throw new Error("Pedido ja foi recebido.");

    for (const item of pedido.itens || []) {
      if (!item.insumoId) continue;
      const insumo =
        (await obterDocumento<Insumo>(getInsumosCollectionPath(context.empresaId), item.insumoId)) ||
        (await obterDocumento<Insumo>("insumos", item.insumoId));
      if (!insumo) continue;
      if (insumo.lojaId && insumo.lojaId !== context.lojaId) {
        throw new Error(`Insumo ${item.insumoNome} pertence a outra loja.`);
      }

      const atual = Number(insumo.estoqueAtual ?? insumo.quantidadeAtual) || 0;
      const custoAtual = Number(insumo.custoUnitarioCompra ?? insumo.custoCompra ?? insumo.custoUnitario) || 0;
      const quantidade = Number(item.quantidade) || 0;
      const custoUnitario = Number(item.valorUnitario) || 0;
      const novoEstoque = atual + quantidade;
      const novoCusto = novoEstoque > 0
        ? Math.round(((atual * custoAtual + quantidade * custoUnitario) / novoEstoque) * 10000) / 10000
        : custoUnitario;

      const payloadAtualizado = normalizarInsumoFinanceiro({
        ...insumo,
          custoAnterior: custoAtual,
          custoUnitarioCompra: novoCusto,
          empresaId: context.empresaId,
          estoqueAtual: novoEstoque,
          lojaId: context.lojaId,
          quantidadeAtual: novoEstoque,
      });

      if (insumo.empresaId === context.empresaId || insumo.lojaId === context.lojaId) {
        await criarDocumento(getInsumosCollectionPath(context.empresaId), payloadAtualizado, item.insumoId);
      } else {
        await atualizarDocumento<Insumo>(getInsumosCollectionPath(context.empresaId), item.insumoId, payloadAtualizado);
      }

      await criarDocumento(getHistoricoEstoqueCollectionPath(context.empresaId), {
        custoUnitario,
        data: new Date(),
        empresaId: context.empresaId,
        insumoId: item.insumoId,
        insumoNome: item.insumoNome,
        lojaId: context.lojaId,
        pedidoCompraId: id,
        quantidade,
        tipoMovimentacao: "compra",
        tipo: "entrada",
        unidade: item.unidade,
        usuarioId: context.uid,
        responsavel: context.uid,
        observacao: `Recebimento do pedido ${pedido.numero}`,
      });
    }

    await atualizarDocumento<PedidoCompra>(getPedidosCollectionPath(context.empresaId), id, {
      dataRecebimento: new Date(),
      empresaId: context.empresaId,
      lojaId: context.lojaId,
      status: "recebido",
    });
  } catch (error) {
    console.error("Erro ao registrar recebimento do pedido", error);
    throw error;
  }
}
