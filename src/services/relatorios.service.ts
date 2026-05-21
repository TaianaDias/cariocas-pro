import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

import { db } from "../lib/firebase";
import type { Desperdicio, Insumo, PedidoCompra } from "../types";
import { listarPedidos } from "./compras.service";
import { obterTodos } from "./db";
import { listarDesperdicios } from "./desperdicio.service";
import { listarOrdensProducao } from "./producao.service";

export interface RelatorioPedidos {
  fornecedor: string;
  totalPedidos: number;
  valorTotal: number;
  itensComprados: number;
}

export interface RelatorioProduto {
  nome: string;
  sku: string;
  categoria: string;
  quantidadeComprada: number;
  valorTotal: number;
  consumoDiario: number;
  diasCobertura: number;
}

export interface ResumoRelatorio {
  periodo: { inicio: Date; fim: Date };
  custoCompras: number;
  custoDesperdicio: number;
  totalMovimentacoes: number;
  topInsumos: { nome: string; total: number }[];
  topFornecedores: { nome: string; total: number }[];
}

function roundMoney(valor: number) {
  return Math.round(valor * 100) / 100;
}

function toDateValue(valor: unknown): Date | null {
  if (valor instanceof Date) return valor;
  if (valor && typeof valor === "object" && "toDate" in valor && typeof valor.toDate === "function") {
    return valor.toDate() as Date;
  }
  return null;
}

export async function getRelatorioCompras(dataInicio: Date, dataFim: Date): Promise<RelatorioPedidos[]> {
  const pedidosQuery = query(
    collection(db, "pedidos_compra"),
    where("dataPedido", ">=", dataInicio),
    where("dataPedido", "<=", dataFim),
    orderBy("dataPedido", "desc"),
  );
  const snapshot = await getDocs(pedidosQuery);
  const agrupado: Record<string, RelatorioPedidos> = {};

  for (const item of snapshot.docs) {
    const pedido = item.data() as PedidoCompra;
    const nome = pedido.fornecedorNome || "Desconhecido";
    if (!agrupado[nome]) {
      agrupado[nome] = { fornecedor: nome, itensComprados: 0, totalPedidos: 0, valorTotal: 0 };
    }

    agrupado[nome].totalPedidos += 1;
    agrupado[nome].valorTotal += pedido.valorTotal || 0;
    agrupado[nome].itensComprados += (pedido.itens || []).length;
  }

  return Object.values(agrupado).sort((a, b) => b.valorTotal - a.valorTotal);
}

export async function getRelatorioProdutos(dataInicio: Date, dataFim: Date): Promise<RelatorioProduto[]> {
  const historicoQuery = query(
    collection(db, "historico"),
    where("criadoEm", ">=", dataInicio),
    where("criadoEm", "<=", dataFim),
    where("tipo", "==", "entrada"),
    orderBy("criadoEm", "desc"),
  );
  const [historicoSnap, insumosSnap, categoriasSnap] = await Promise.all([
    getDocs(historicoQuery),
    getDocs(collection(db, "insumos")),
    getDocs(collection(db, "categoriasInsumos")),
  ]);

  const insumos = new Map<string, Insumo>();
  insumosSnap.forEach((item) => insumos.set(item.id, item.data() as Insumo));

  const categorias = new Map<string, string>();
  categoriasSnap.forEach((item) => categorias.set(item.id, String(item.data().nome || item.id)));

  const agrupado: Record<string, RelatorioProduto> = {};

  for (const item of historicoSnap.docs) {
    const data = item.data();
    const id = String(data.insumoId || "unknown");
    const insumo = insumos.get(id);

    if (!agrupado[id]) {
      agrupado[id] = {
        categoria: categorias.get(insumo?.categoriaId || "") || "-",
        consumoDiario: 0,
        diasCobertura: 0,
        nome: String(data.insumoNome || insumo?.nome || "Desconhecido"),
        quantidadeComprada: 0,
        sku: insumo?.sku || "",
        valorTotal: 0,
      };
    }

    agrupado[id].quantidadeComprada += Number(data.quantidade || 0);
    agrupado[id].valorTotal += Number(data.custoTotal || 0);
  }

  return Object.values(agrupado)
    .sort((a, b) => b.valorTotal - a.valorTotal)
    .slice(0, 50);
}

export async function getResumoRelatorio(dataInicio: Date, dataFim: Date): Promise<ResumoRelatorio> {
  const [comprasSnap, desperdicioSnap, historicoSnap] = await Promise.all([
    getDocs(query(collection(db, "pedidos_compra"), where("dataPedido", ">=", dataInicio), where("dataPedido", "<=", dataFim))),
    getDocs(query(collection(db, "desperdicio"), where("data", ">=", dataInicio), where("data", "<=", dataFim))),
    getDocs(query(collection(db, "historico"), where("criadoEm", ">=", dataInicio), where("criadoEm", "<=", dataFim))),
  ]);

  const custoCompras = comprasSnap.docs.reduce((acc, item) => acc + (Number(item.data().valorTotal) || 0), 0);
  const custoDesperdicio = desperdicioSnap.docs.reduce((acc, item) => acc + (Number(item.data().custoEstimado) || 0), 0);

  const insumosAgrupados: Record<string, number> = {};
  historicoSnap.forEach((item) => {
    const data = item.data();
    if (data.insumoNome) {
      insumosAgrupados[String(data.insumoNome)] = (insumosAgrupados[String(data.insumoNome)] || 0) + (Number(data.quantidade) || 0);
    }
  });

  const fornecedoresAgrupados: Record<string, number> = {};
  comprasSnap.forEach((item) => {
    const nome = String(item.data().fornecedorNome || "Desconhecido");
    fornecedoresAgrupados[nome] = (fornecedoresAgrupados[nome] || 0) + 1;
  });

  return {
    custoCompras: roundMoney(custoCompras),
    custoDesperdicio: roundMoney(custoDesperdicio),
    periodo: { fim: dataFim, inicio: dataInicio },
    topFornecedores: Object.entries(fornecedoresAgrupados)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, total]) => ({ nome, total })),
    topInsumos: Object.entries(insumosAgrupados)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nome, total]) => ({ nome, total })),
    totalMovimentacoes: historicoSnap.size,
  };
}

export async function getCustoTotalPeriodo(
  dataInicio: Date,
  dataFim: Date,
): Promise<{ custoCompras: number; custoDesperdicio: number; custoProducao: number; total: number }> {
  try {
    const pedidos = await listarPedidos();
    const desperdicios = await listarDesperdicios(dataInicio, dataFim);
    await listarOrdensProducao();

    const pedidosNoPeriodo = pedidos.filter((pedido) => {
      const dataPedido = toDateValue(pedido.dataPedido) || pedido.dataPedido;
      return dataPedido >= dataInicio && dataPedido <= dataFim && pedido.status === "recebido";
    });
    const custoCompras = pedidosNoPeriodo.reduce((acc, pedido) => acc + (pedido.valorTotal || 0), 0);
    const custoDesperdicio = desperdicios.reduce((acc, item) => acc + (item.custoEstimado || 0), 0);

    return {
      custoCompras: roundMoney(custoCompras),
      custoDesperdicio: roundMoney(custoDesperdicio),
      custoProducao: 0,
      total: roundMoney(custoCompras + custoDesperdicio),
    };
  } catch (error) {
    console.error("Erro ao calcular custo total", error);
    return { custoCompras: 0, custoDesperdicio: 0, custoProducao: 0, total: 0 };
  }
}

export async function getCmvMedioPeriodo(dataInicio: Date, dataFim: Date): Promise<number> {
  try {
    void dataInicio;
    void dataFim;
    const todos = await obterTodos<Insumo>("insumos");
    const comCmv = todos.filter((item) => item.cmv > 0);
    if (comCmv.length === 0) return 0;
    const media = comCmv.reduce((acc, item) => acc + item.cmv, 0) / comCmv.length;
    return Math.round(media * 10) / 10;
  } catch (error) {
    console.error("Erro ao calcular CMV medio", error);
    return 0;
  }
}

export async function getTopInsumosMaisComprados(limite = 10): Promise<{ nome: string; total: number }[]> {
  try {
    const pedidos = await listarPedidos();
    const contagem: Record<string, number> = {};
    for (const pedido of pedidos as PedidoCompra[]) {
      for (const item of pedido.itens || []) {
        contagem[item.insumoNome] = (contagem[item.insumoNome] || 0) + item.quantidade;
      }
    }
    return Object.entries(contagem)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limite);
  } catch (error) {
    console.error("Erro ao listar top insumos", error);
    return [];
  }
}

export async function getFornecedoresMaisUtilizados(limite = 5): Promise<{ nome: string; totalPedidos: number }[]> {
  try {
    const pedidos = await listarPedidos();
    const contagem: Record<string, number> = {};
    for (const pedido of pedidos) {
      if (pedido.fornecedorNome) {
        contagem[pedido.fornecedorNome] = (contagem[pedido.fornecedorNome] || 0) + 1;
      }
    }
    return Object.entries(contagem)
      .map(([nome, totalPedidos]) => ({ nome, totalPedidos }))
      .sort((a, b) => b.totalPedidos - a.totalPedidos)
      .slice(0, limite);
  } catch (error) {
    console.error("Erro ao listar fornecedores mais utilizados", error);
    return [];
  }
}

export async function getResumoCompleto(dataInicio: Date, dataFim: Date) {
  try {
    const [custos, cmv, topInsumos, topFornecedores] = await Promise.all([
      getCustoTotalPeriodo(dataInicio, dataFim),
      getCmvMedioPeriodo(dataInicio, dataFim),
      getTopInsumosMaisComprados(),
      getFornecedoresMaisUtilizados(),
    ]);

    return {
      cmvMedio: cmv,
      custos,
      periodo: { inicio: dataInicio, fim: dataFim },
      topFornecedores,
      topInsumos,
    };
  } catch (error) {
    console.error("Erro ao gerar resumo completo", error);
    return {
      cmvMedio: 0,
      custos: { custoCompras: 0, custoDesperdicio: 0, custoProducao: 0, total: 0 },
      periodo: { inicio: dataInicio, fim: dataFim },
      topFornecedores: [],
      topInsumos: [],
    };
  }
}

export type RelatorioDiario = {
  id?: string;
  data: Date;
  compras: PedidoCompra[];
  desperdicios: Desperdicio[];
};

export async function listarRelatorios(): Promise<RelatorioDiario[]> {
  return [];
}

export async function buscarRelatorio(id: string): Promise<RelatorioDiario | null> {
  void id;
  return null;
}
