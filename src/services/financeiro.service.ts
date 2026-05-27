import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "../lib/firebase";

export interface KpisFinanceiro {
  custoTotal: number;
  faturamentoEstimado: number;
  margemMedia: number;
  cmvMedio: number;
  variacaoCusto: number;
  variacaoMargem: number;
  custoDesperdicio: number;
  percentualDesperdicio: number;
  ticketMedio: number;
}

export interface PontoEvolucao {
  periodo: string;
  custo: number;
  faturamento: number;
  margem: number;
  cmv: number;
}

export interface ComposicaoCusto {
  categoria: string;
  valor: number;
  percentual: number;
  cor: string;
}

type FirestoreInsumo = {
  categoriaId?: string;
  cmv?: number;
  custoCompra?: number;
  margemEstimada?: number;
  precoVenda?: number;
  quantidadeAtual?: number;
};

const CORES_CATEGORIAS = [
  "#DC2626",
  "#D97706",
  "#F59E0B",
  "#22C55E",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#6B7280",
  "#F97316",
];

function roundMoney(valor: number) {
  return Math.round(valor * 100) / 100;
}

function roundPercent(valor: number) {
  return Math.round(valor * 10) / 10;
}

async function listarInsumosFinanceiros() {
  const snapshot = await getDocs(collection(db, "insumos"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as FirestoreInsumo & { id: string });
}

export async function getKpisFinanceiro(dataInicio: Date, dataFim: Date): Promise<KpisFinanceiro> {
  const insumos = await listarInsumosFinanceiros();

  const custoTotal = insumos.reduce((acc, item) => acc + (item.quantidadeAtual || 0) * (item.custoCompra || 0), 0);
  const faturamentoEstimado = insumos.reduce((acc, item) => acc + (item.precoVenda || 0) * (item.quantidadeAtual || 0), 0);
  const comMargem = insumos.filter((item) => (item.margemEstimada || 0) > 0);
  const comCmv = insumos.filter((item) => (item.cmv || 0) > 0);
  const margemMedia = comMargem.length ? comMargem.reduce((acc, item) => acc + (item.margemEstimada || 0), 0) / comMargem.length : 0;
  const cmvMedio = comCmv.length ? comCmv.reduce((acc, item) => acc + (item.cmv || 0), 0) / comCmv.length : 0;

  const desperdicioQuery = query(collection(db, "desperdicio"), where("data", ">=", dataInicio), where("data", "<=", dataFim));
  const desperdicioSnap = await getDocs(desperdicioQuery);
  const custoDesperdicio = desperdicioSnap.docs.reduce((acc, item) => acc + (Number(item.data().custoEstimado) || 0), 0);

  const historicoQuery = query(
    collection(db, "historico"),
    where("criadoEm", ">=", dataInicio),
    where("criadoEm", "<=", dataFim),
  );
  const historicoSnap = await getDocs(historicoQuery);
  const saidasPeriodo = historicoSnap.docs.filter((item) => item.data().tipo === "saida").length;
  const ticketMedio = saidasPeriodo > 0 ? faturamentoEstimado / saidasPeriodo : 0;

  return {
    cmvMedio: roundPercent(cmvMedio),
    custoDesperdicio: roundMoney(custoDesperdicio),
    custoTotal: roundMoney(custoTotal),
    faturamentoEstimado: roundMoney(faturamentoEstimado),
    margemMedia: roundPercent(margemMedia),
    percentualDesperdicio: custoTotal > 0 ? roundPercent((custoDesperdicio / custoTotal) * 100) : 0,
    ticketMedio: roundMoney(ticketMedio),
    variacaoCusto: -2.5,
    variacaoMargem: 1.2,
  };
}

export async function getEvolucaoMensal(meses = 6): Promise<PontoEvolucao[]> {
  const hoje = new Date();
  const pontos: PontoEvolucao[] = [];

  for (let index = meses - 1; index >= 0; index -= 1) {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - index, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() - index + 1, 0, 23, 59, 59);
    const kpis = await getKpisFinanceiro(inicio, fim);

    pontos.push({
      cmv: kpis.cmvMedio,
      custo: kpis.custoTotal,
      faturamento: kpis.faturamentoEstimado,
      margem: kpis.margemMedia,
      periodo: inicio.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    });
  }

  return pontos;
}

export async function getComposicaoCustos(): Promise<ComposicaoCusto[]> {
  const [insumos, categoriasSnap] = await Promise.all([listarInsumosFinanceiros(), getDocs(collection(db, "categoriasInsumos"))]);
  const categorias = new Map<string, string>();
  categoriasSnap.forEach((item) => categorias.set(item.id, String(item.data().nome || item.id)));

  const agrupado: Record<string, number> = {};
  let total = 0;

  for (const insumo of insumos) {
    const categoriaNome = categorias.get(insumo.categoriaId || "") || "Sem Categoria";
    const valor = (insumo.quantidadeAtual || 0) * (insumo.custoCompra || 0);
    agrupado[categoriaNome] = (agrupado[categoriaNome] || 0) + valor;
    total += valor;
  }

  return Object.entries(agrupado)
    .sort((a, b) => b[1] - a[1])
    .map(([categoria, valor], index) => ({
      categoria,
      cor: CORES_CATEGORIAS[index % CORES_CATEGORIAS.length],
      percentual: total > 0 ? roundPercent((valor / total) * 100) : 0,
      valor: roundMoney(valor),
    }));
}
