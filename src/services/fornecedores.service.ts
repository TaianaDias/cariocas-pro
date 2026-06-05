import type { Fornecedor, FornecedorVinculo, Insumo } from "../types";
import { atualizarDocumento, batchEscrita, consultar, criarDocumento, deletarDocumento, obterDocumento, obterTodos } from "./db";

const COLECAO = "fornecedores";
const COLECAO_INSUMOS = "insumos";

type VincularInsumoFornecedorInput = {
  conversao?: number;
  custoUnitario: number;
  diasEntrega?: number;
  diasPedido?: number;
  frequenciaPedido?: string;
  principal?: boolean;
  quantidadePadrao?: number;
  unidadeUso?: string;
};

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
    await removerFornecedorDosInsumos(id);
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

export async function vincularInsumoAoFornecedor(
  fornecedor: Fornecedor,
  insumo: Insumo,
  dados: VincularInsumoFornecedorInput,
): Promise<void> {
  try {
    if (!fornecedor.id || !insumo.id) throw new Error("Fornecedor e insumo sao obrigatorios.");
    if (dados.custoUnitario <= 0) throw new Error("Informe um custo maior que zero.");

    const vinculosAtuais = insumo.fornecedores || [];
    const outrosFornecedores = vinculosAtuais.filter((item) => item.fornecedorId !== fornecedor.id);
    const principal = Boolean(dados.principal) || vinculosAtuais.length === 0;
    const vinculo: FornecedorVinculo = {
      cnpjFornecedor: fornecedor.cnpj,
      conversao: Number(dados.conversao) || 1,
      custo: Number(dados.custoUnitario) || 0,
      custoUnitario: Number(dados.custoUnitario) || 0,
      diasEntrega: Number(dados.diasEntrega) || 0,
      diasPedido: Number(dados.diasPedido) || 0,
      fornecedorId: fornecedor.id,
      fornecedorNome: fornecedor.nome,
      frequenciaPedido: dados.frequenciaPedido || "",
      principal,
      quantidadePadrao: Number(dados.quantidadePadrao) || 1,
      telefoneFornecedor: fornecedor.telefone,
      unidadeUso: dados.unidadeUso || insumo.unidadeCompra || insumo.unidadeMedida,
    };
    const fornecedores = principal ? outrosFornecedores.map((item) => ({ ...item, principal: false })) : outrosFornecedores;
    const proximosFornecedores = [...fornecedores, vinculo];
    const fornecedorPrincipal = principal || !insumo.fornecedorPrincipal ? fornecedor.nome : insumo.fornecedorPrincipal;

    await atualizarDocumento<Insumo>(COLECAO_INSUMOS, insumo.id, {
      fornecedorPrincipal,
      fornecedores: proximosFornecedores,
    });

    await criarDocumento(`${COLECAO}/${fornecedor.id}/produtos`, {
      ...vinculo,
      insumoId: insumo.id,
      insumoNome: insumo.nome,
    });
  } catch (error) {
    console.error("Erro ao vincular insumo ao fornecedor", error);
    throw error;
  }
}

async function removerFornecedorDosInsumos(fornecedorId: string): Promise<void> {
  const insumos = await obterTodos<Insumo>(COLECAO_INSUMOS);
  const operacoes = insumos
    .filter((insumo) => insumo.id && insumo.fornecedores?.some((fornecedor) => fornecedor.fornecedorId === fornecedorId))
    .map((insumo) => {
      const fornecedores = (insumo.fornecedores || []).filter((fornecedor) => fornecedor.fornecedorId !== fornecedorId);
      const principal = fornecedores.find((fornecedor) => fornecedor.principal) || fornecedores[0];

      return {
        caminho: COLECAO_INSUMOS,
        dados: {
          fornecedorPrincipal: principal?.fornecedorNome || "",
          fornecedores: fornecedores.map((fornecedor, index) => ({ ...fornecedor, principal: fornecedor.principal || index === 0 })),
        },
        docId: insumo.id!,
        tipo: "update" as const,
      };
    });

  if (operacoes.length) {
    await batchEscrita(operacoes);
  }
}
