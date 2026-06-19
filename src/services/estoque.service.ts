import type { Insumo } from "../types";
import {
  atualizarDocumento,
  consultar,
  criarDocumento,
  deletarDocumento,
  obterDocumento,
  ouvirColecao,
} from "./db";

const COLECAO = "insumos";

export function getInsumosCollectionPath(empresaId?: string) {
  return empresaId ? `empresas/${empresaId}/insumos` : COLECAO;
}

export function getHistoricoEstoqueCollectionPath(empresaId?: string) {
  return empresaId ? `empresas/${empresaId}/historicoEstoque` : "historico";
}

export function normalizarInsumoFinanceiro<T extends Partial<Insumo>>(dados: T): T {
  const fatorConversao = Number(dados.fatorConversao ?? dados.conversao) || 1;
  const custoUnitarioCompra = Number(dados.custoUnitarioCompra ?? dados.custoCompra ?? dados.custoUnitario) || 0;
  const estoqueAtual = Number(dados.estoqueAtual ?? dados.quantidadeAtual) || 0;

  return {
    ...dados,
    conversao: fatorConversao,
    custoCompra: custoUnitarioCompra,
    custoUnitario: custoUnitarioCompra,
    custoUnitarioCompra,
    custoUnitarioUso: fatorConversao > 0 ? custoUnitarioCompra / fatorConversao : custoUnitarioCompra,
    estoqueAtual,
    fatorConversao,
    quantidadeAtual: estoqueAtual,
  };
}

type FiltrosInsumos = {
  categoriaId?: string;
  empresaId?: string;
  fornecedorId?: string;
  lojaId?: string;
  status?: string;
  busca?: string;
  apenasCriticos?: boolean;
};

export async function listarInsumos(filtros?: FiltrosInsumos): Promise<Insumo[]> {
  try {
    const caminho = getInsumosCollectionPath(filtros?.empresaId);
    const filtrosConsulta = [
      ...(!filtros?.empresaId && filtros?.empresaId ? [{ campo: "empresaId", operador: "==" as const, valor: filtros.empresaId }] : []),
      ...(filtros?.lojaId ? [{ campo: "lojaId", operador: "==" as const, valor: filtros.lojaId }] : []),
      ...(filtros?.categoriaId ? [{ campo: "categoriaId", operador: "==" as const, valor: filtros.categoriaId }] : []),
      ...(filtros?.status ? [{ campo: "status", operador: "==" as const, valor: filtros.status }] : []),
      ...(filtros?.apenasCriticos ? [{ campo: "quantidadeAtual", operador: "<=" as const, valor: 0 }] : []),
    ];

    let dados = await consultar<Insumo>(caminho, filtrosConsulta);
    if (filtros?.empresaId && dados.length === 0) {
      dados = await consultar<Insumo>(COLECAO, [
        { campo: "empresaId", operador: "==" as const, valor: filtros.empresaId },
        ...(filtros?.lojaId ? [{ campo: "lojaId", operador: "==" as const, valor: filtros.lojaId }] : []),
        ...(filtros?.categoriaId ? [{ campo: "categoriaId", operador: "==" as const, valor: filtros.categoriaId }] : []),
        ...(filtros?.status ? [{ campo: "status", operador: "==" as const, valor: filtros.status }] : []),
      ]);
    }

    const resultados = dados
      .map((item) => normalizarInsumoFinanceiro(item))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    if (!filtros?.busca) {
      return resultados;
    }

    const busca = filtros.busca.toLowerCase();
    return resultados.filter(
      (item) =>
        item.nome.toLowerCase().includes(busca) ||
        item.sku.toLowerCase().includes(busca) ||
        item.codigoBarras.includes(busca),
    );
  } catch (error) {
    console.error("Erro ao listar insumos", error);
    return [];
  }
}

export function ouvirInsumos(callback: (insumos: Insumo[]) => void, categoriaId?: string, context?: { empresaId?: string; lojaId?: string }): () => void {
  try {
    const filtros = [
      ...(context?.empresaId ? [{ campo: "empresaId", operador: "==" as const, valor: context.empresaId }] : []),
      ...(context?.lojaId ? [{ campo: "lojaId", operador: "==" as const, valor: context.lojaId }] : []),
      ...(categoriaId ? [{ campo: "categoriaId", operador: "==" as const, valor: categoriaId }] : []),
    ];
    return ouvirColecao<Insumo>(
      getInsumosCollectionPath(context?.empresaId),
      (items) => callback([...items].map((item) => normalizarInsumoFinanceiro(item)).sort((a, b) => a.nome.localeCompare(b.nome))),
      filtros,
    );
  } catch (error) {
    console.error("Erro ao ouvir insumos", error);
    return () => undefined;
  }
}

export async function getInsumo(id: string, context?: { empresaId?: string }): Promise<Insumo | null> {
  try {
    const doc = await obterDocumento<Insumo>(getInsumosCollectionPath(context?.empresaId), id);
    return doc ? normalizarInsumoFinanceiro(doc) : null;
  } catch (error) {
    console.error("Erro ao buscar insumo", error);
    return null;
  }
}

export const buscarInsumo = getInsumo;

export async function getInsumoPorCodigoBarras(codigo: string, context?: { empresaId?: string; lojaId?: string }): Promise<Insumo | null> {
  try {
    const resultados = await consultar<Insumo>(getInsumosCollectionPath(context?.empresaId), [
      ...(context?.lojaId ? [{ campo: "lojaId", operador: "==" as const, valor: context.lojaId }] : []),
      { campo: "codigoBarras", operador: "==" as const, valor: codigo },
    ]);
    return resultados.length > 0 ? normalizarInsumoFinanceiro(resultados[0]) : null;
  } catch (error) {
    console.error("Erro ao buscar insumo por codigo de barras", error);
    return null;
  }
}

export async function criarInsumo(
  dados: Omit<Insumo, "id" | "criadoEm" | "atualizadoEm" | "createdBy">,
  uid: string,
): Promise<string> {
  try {
    if (!dados.empresaId || !dados.lojaId) {
      throw new Error("empresaId e lojaId sao obrigatorios para criar insumo.");
    }
    return criarDocumento(getInsumosCollectionPath(dados.empresaId), normalizarInsumoFinanceiro({ ...dados, createdBy: uid }));
  } catch (error) {
    console.error("Erro ao criar insumo", error);
    throw error;
  }
}

export async function atualizarInsumo(id: string, dados: Partial<Insumo>): Promise<void> {
  try {
    if (!dados.empresaId || !dados.lojaId) {
      throw new Error("empresaId e lojaId sao obrigatorios para atualizar insumo.");
    }
    return atualizarDocumento<Insumo>(getInsumosCollectionPath(dados.empresaId), id, normalizarInsumoFinanceiro(dados));
  } catch (error) {
    console.error("Erro ao atualizar insumo", error);
    throw error;
  }
}

export async function deletarInsumo(id: string, context?: { empresaId?: string }): Promise<void> {
  try {
    return deletarDocumento(getInsumosCollectionPath(context?.empresaId), id);
  } catch (error) {
    console.error("Erro ao deletar insumo", error);
    throw error;
  }
}

export const removerInsumo = deletarInsumo;

export async function getInsumosCriticos(): Promise<Insumo[]> {
  try {
    return consultar<Insumo>(
      COLECAO,
      [
        { campo: "quantidadeAtual", operador: "<=" as const, valor: 0 },
        { campo: "status", operador: "==" as const, valor: "ativo" },
      ],
      { campo: "quantidadeAtual", direcao: "asc" },
    );
  } catch (error) {
    console.error("Erro ao listar insumos criticos", error);
    return [];
  }
}

export async function getInsumosAVencer(dias = 3): Promise<Insumo[]> {
  try {
    const todos = await consultar<Insumo>(COLECAO, [], { campo: "nome", direcao: "asc" });
    return todos.filter((item) => item.validadeOriginal > 0 && item.validadeOriginal <= dias);
  } catch (error) {
    console.error("Erro ao listar insumos a vencer", error);
    return [];
  }
}

export async function getInsumosAbaixoMinimo(): Promise<Insumo[]> {
  try {
    return consultar<Insumo>(
      COLECAO,
      [
        { campo: "quantidadeAtual", operador: "<=" as const, valor: 1 },
        { campo: "estoqueMinimo", operador: ">" as const, valor: 0 },
      ],
      { campo: "quantidadeAtual", direcao: "asc" },
    );
  } catch (error) {
    console.error("Erro ao listar insumos abaixo do minimo", error);
    return [];
  }
}
