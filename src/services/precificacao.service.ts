import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";

import { db } from "../lib/firebase";
import type {
  CustosFixosPrecificacao,
  CustosVariaveisPrecificacao,
  HistoricoCustoInsumo,
  Insumo,
  MetaFinanceiraPrecificacao,
  PrecificacaoCanal,
  ReceitaIngrediente,
  ReceitaPrecificacao,
  SimulacaoPreco,
  StatusFinanceiroReceita,
  UnidadeMedidaPrecificacao,
} from "../types";

export const PRECIFICACAO_COLLECTIONS = {
  custosFixos: "custosFixos",
  historicoCustosInsumos: "historicoCustosInsumos",
  metasFinanceiras: "metasFinanceiras",
  receitaIngredientes: "receitaIngredientes",
  receitas: "receitas",
  simulacoesPreco: "simulacoesPreco",
} as const;

function getReceitasCollectionPath(empresaId?: string) {
  return empresaId ? `empresas/${empresaId}/receitas` : PRECIFICACAO_COLLECTIONS.receitas;
}

function getHistoricoReceitasCollectionPath(empresaId?: string) {
  return empresaId ? `empresas/${empresaId}/historicoReceitas` : "historicoReceitas";
}

export * from "../domain/precificacao";
import { calcularCustoFixoPorPedido } from "../domain/precificacao";

export async function listarReceitasPrecificacao(empresaId: string, lojaId?: string) {
  const receitasQuery = query(collection(db, getReceitasCollectionPath(empresaId)));
  const snapshot = await getDocs(receitasQuery);
  let receitas = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ReceitaPrecificacao);

  if (!receitas.length) {
    const legadoQuery = query(collection(db, PRECIFICACAO_COLLECTIONS.receitas), where("empresaId", "==", empresaId));
    const legado = await getDocs(legadoQuery);
    receitas = legado.docs.map((item) => ({ id: item.id, ...item.data() }) as ReceitaPrecificacao);
  }

  if (!lojaId) {
    return receitas.filter((receita) => receita.globalEmpresa === true || !receita.lojaId);
  }

  return receitas.filter((receita) => receita.lojaId === lojaId || receita.globalEmpresa === true);
}

export function mascararReceitaPrecificacao(receita: ReceitaPrecificacao): ReceitaPrecificacao {
  return {
    ...receita,
    canais: [],
    custoFixoRateado: 0,
    custoIngredientes: 0,
    custoTotalReal: 0,
    custosVariaveis: 0,
    ingredientes: receita.ingredientes.map((ingrediente) => ({
      ...ingrediente,
      custoTotal: 0,
      custoUnitarioConvertido: 0,
    })),
    lucro: 0,
    margem: 0,
    precoMinimo: 0,
    precoPremium: 0,
    precoSugerido: 0,
  };
}

export async function salvarReceitaPrecificacao(receita: ReceitaPrecificacao) {
  if (receita.precoVenda <= 0) {
    throw new Error("Preço de venda precisa ser maior que zero.");
  }

  if (!receita.ingredientes.length) {
    throw new Error("Receita precisa ter pelo menos um ingrediente.");
  }

  if (!receita.empresaId) {
    throw new Error("empresaId e obrigatório.");
  }

  if (!receita.globalEmpresa && !receita.lojaId) {
    throw new Error("lojaId e obrigatório para receitas de loja.");
  }

  const id = receita.id || doc(collection(db, getReceitasCollectionPath(receita.empresaId))).id;
  const receitaRef = doc(db, getReceitasCollectionPath(receita.empresaId), id);
  const existenteSnap = await getDoc(receitaRef);
  const existente = existenteSnap.exists() ? ({ id: existenteSnap.id, ...existenteSnap.data() } as ReceitaPrecificacao) : null;

  if (existente) {
    const historicoId = doc(collection(db, getHistoricoReceitasCollectionPath(receita.empresaId))).id;
    await setDoc(doc(db, getHistoricoReceitasCollectionPath(receita.empresaId), historicoId), {
      alteradoEm: serverTimestamp(),
      custoAnterior: existente.custoCmv ?? existente.custoIngredientes ?? 0,
      custoNovo: receita.custoCmv ?? receita.custoIngredientes ?? 0,
      empresaId: receita.empresaId,
      ingredientesAntigos: existente.ingredientes || [],
      ingredientesNovos: receita.ingredientes || [],
      lojaId: receita.lojaId || null,
      precoAnterior: existente.precoVenda || 0,
      precoNovo: receita.precoVenda || 0,
      receitaId: id,
      receitaNome: receita.nome,
      usuario: receita.createdBy || "sistema",
    });
  }

  await setDoc(
    receitaRef,
    {
      ...receita,
      custoCmv: receita.custoIngredientes,
      fichaTecnicaIngredientes: receita.ingredientes.map((ingrediente) => ({
        insumoId: ingrediente.insumoId,
        nome: ingrediente.insumoNome,
        quantidade: ingrediente.quantidade,
        unidade: ingrediente.unidade,
      })),
      fichaTecnicaMigradaEm: serverTimestamp(),
      id,
      atualizadoEm: serverTimestamp(),
      criadoEm: receita.criadoEm || serverTimestamp(),
    },
    { merge: true },
  );

  return id;
}

export async function salvarCustosFixos(custos: CustosFixosPrecificacao) {
  if (!custos.empresaId || !custos.lojaId) {
    throw new Error("empresaId e lojaId são obrigatórios para custos fixos.");
  }

  const id = `${custos.empresaId}_${custos.lojaId}`;
  await setDoc(
    doc(db, PRECIFICACAO_COLLECTIONS.custosFixos, id),
    {
      ...custos,
      custoFixoPorPedido: calcularCustoFixoPorPedido(custos),
      atualizadoEm: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function registrarHistoricoCusto(dados: HistoricoCustoInsumo) {
  const id = dados.id || doc(collection(db, PRECIFICACAO_COLLECTIONS.historicoCustosInsumos)).id;
  await setDoc(doc(db, PRECIFICACAO_COLLECTIONS.historicoCustosInsumos, id), {
    ...dados,
    data: serverTimestamp(),
    id,
  });
}
