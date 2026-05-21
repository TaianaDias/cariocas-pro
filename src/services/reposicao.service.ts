import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "../lib/firebase";
import type { FornecedorVinculo, Insumo } from "../types";
import type { AlertaReposicao } from "./alertas.service";

const COLECAO_HISTORICO = "historico";

function dataTrintaDiasAtras() {
  const data = new Date();
  data.setDate(data.getDate() - 30);
  return data;
}

export async function calcularConsumoDiario(insumoId: string): Promise<number> {
  const consulta = query(
    collection(db, COLECAO_HISTORICO),
    where("insumoId", "==", insumoId),
    where("tipo", "in", ["saida", "producao", "saida_producao"]),
    where("criadoEm", ">=", dataTrintaDiasAtras()),
  );
  const snap = await getDocs(consulta);
  if (snap.empty) return 0;

  let totalSaida = 0;
  snap.forEach((item) => {
    totalSaida += Math.abs(Number(item.data().quantidade || 0));
  });

  return Math.round((totalSaida / 30) * 100) / 100;
}

export function calcularQtdSugerida(insumo: Insumo, consumoDiario: number): number {
  const minimo = insumo.estoqueMinimo || 0;
  const maximo = insumo.estoqueMaximo || Math.max(minimo * 2, consumoDiario * 7);
  const atual = insumo.quantidadeAtual || 0;
  const qtd = Math.max(maximo - atual, minimo);
  const qtdPadrao = insumo.quantidadePadraoPedido || 1;
  return Math.ceil(qtd / qtdPadrao) * qtdPadrao;
}

export function buscarMelhorFornecedor(insumo: Insumo): FornecedorVinculo | null {
  const fornecedores = insumo.fornecedores || [];
  if (fornecedores.length === 0) return null;
  const principal = fornecedores.find((fornecedor) => fornecedor.principal);
  if (principal) return principal;
  return [...fornecedores].sort((a, b) => (a.custoUnitario || a.custo || 0) - (b.custoUnitario || b.custo || 0))[0] || null;
}

export function montarLinkWhatsApp(telefone: string, insumoNome: string, qtd: number, unidade: string): string {
  const numero = telefone.replace(/\D/g, "");
  const mensagem = encodeURIComponent(
    `Ola! Gostaria de fazer um pedido de:\n\n${insumoNome}\nQuantidade: ${qtd} ${unidade}\n\nPedido automatico - Carioca's.`,
  );
  return `https://wa.me/55${numero}?text=${mensagem}`;
}

export function calcularDiasCobertura(estoqueAtual: number, consumoDiario: number): number {
  if (consumoDiario <= 0) return 999;
  return Math.floor(estoqueAtual / consumoDiario);
}

export async function calcularAlertaReposicao(insumo: Insumo): Promise<AlertaReposicao | null> {
  if (!insumo.id) return null;
  const consumoDiario = await calcularConsumoDiario(insumo.id);
  const diasCobertura = calcularDiasCobertura(insumo.quantidadeAtual, consumoDiario);
  const melhorFornecedor = buscarMelhorFornecedor(insumo);
  const prazoEntrega = melhorFornecedor?.diasEntrega ?? insumo.diasEntrega ?? 0;
  const diasPedido = insumo.diasPedido ?? 0;
  const limiteCritico = prazoEntrega + diasPedido + 1;
  const qtdSugerida = calcularQtdSugerida(insumo, consumoDiario);

  let nivel: AlertaReposicao["nivel"] | null = null;
  let mensagem = "";

  if (insumo.quantidadeAtual <= 0) {
    nivel = "critical";
    mensagem = `${insumo.nome} esta com estoque zerado`;
  } else if (diasCobertura <= 1) {
    nivel = "critical";
    mensagem = `${insumo.nome} esta com cobertura critica (${diasCobertura}d)`;
  } else if (diasCobertura <= limiteCritico || insumo.quantidadeAtual <= insumo.estoqueMinimo) {
    nivel = "warning";
    mensagem = `${insumo.nome} precisa de reposicao (${diasCobertura}d de cobertura)`;
  }

  if (!nivel) return null;

  const custoFornecedor = melhorFornecedor?.custoUnitario || melhorFornecedor?.custo || insumo.custoCompra;
  const telefone = melhorFornecedor?.telefoneFornecedor;

  return {
    acaoSugerida: `Comprar ${qtdSugerida} ${insumo.unidadeCompra || "un"}`,
    consumoDiario,
    criadoEm: new Date(),
    custoEstimado: Math.round(qtdSugerida * custoFornecedor * 100) / 100,
    diasAtePedido: Math.max(0, diasCobertura - prazoEntrega - diasPedido),
    diasCobertura,
    diasPedido,
    economiaEstimada: Math.max(0, Math.round((insumo.custoCompra - custoFornecedor) * qtdSugerida * 100) / 100),
    estoqueAtual: insumo.quantidadeAtual,
    estoqueMaximo: insumo.estoqueMaximo,
    estoqueMinimo: insumo.estoqueMinimo,
    insumoId: insumo.id,
    insumoNome: insumo.nome,
    lido: false,
    limiteCritico,
    linkWhatsApp: telefone ? montarLinkWhatsApp(telefone, insumo.nome, qtdSugerida, insumo.unidadeCompra || "un") : null,
    melhorFornecedor: melhorFornecedor
      ? {
          custo: custoFornecedor,
          diasEntrega: melhorFornecedor.diasEntrega,
          fornecedorId: melhorFornecedor.fornecedorId,
          fornecedorNome: melhorFornecedor.fornecedorNome,
        }
      : null,
    mensagem,
    nivel,
    prazoEntrega,
    qtdSugerida: Math.round(qtdSugerida),
    resolvido: false,
  };
}
