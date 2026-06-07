import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";

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

export const canaisPadrao: PrecificacaoCanal[] = [
  criarCanal("balcao", 0, 0, 0, 35),
  criarCanal("delivery_proprio", 0, 3.5, 1.9, 38),
  criarCanal("ifood", 0, 14, 2.5, 42),
  criarCanal("99food", 0, 12, 2.5, 42),
  criarCanal("parceiros", 0, 8, 1.8, 36),
];

export const custosVariaveisPadrao: CustosVariaveisPrecificacao = {
  cashback: 0,
  comissaoPercentual: 0,
  cupom: 0,
  embalagem: 1.5,
  embalagemDelivery: 2.5,
  taxa99FoodPercentual: 12,
  taxaCartaoPercentual: 3.5,
  taxaDelivery: 0,
  taxaIfoodPercentual: 14,
};

export const metasPadrao: MetaFinanceiraPrecificacao = {
  cmvMaximo: 32,
  empresaId: "default",
  lucroMinimo: 8,
  margemDesejada: 35,
  margemMinima: 28,
};

export const custosFixosPadrao: CustosFixosPrecificacao = {
  agua: 0,
  aluguel: 0,
  contador: 0,
  custoFixoPorPedido: 0,
  empresaId: "default",
  encargos: 0,
  energia: 0,
  internet: 0,
  manutencao: 0,
  marketing: 0,
  outros: 0,
  pedidosMensais: 1,
  salarios: 0,
  sistema: 0,
};

export function normalizarUnidadePrecificacao(unidade?: string): UnidadeMedidaPrecificacao {
  const value = (unidade || "UN").trim().toUpperCase();
  if (value === "KG" || value === "G" || value === "UN" || value === "ML" || value === "L" || value === "CAIXA" || value === "PACOTE" || value === "FATIA" || value === "PORCAO") {
    return value;
  }

  if (value === "UNIDADE" || value === "UND" || value === "UNID") return "UN";
  if (value === "PORÇÃO") return "PORCAO";
  return "UN";
}

export function calcularCustoUnitarioUsoInsumo(insumo: Pick<Insumo, "conversao" | "custoCompra" | "custoUnitario">) {
  const conversao = Math.max(Number(insumo.conversao) || 1, 1);
  const custoCompra = Number(insumo.custoCompra) || 0;
  return moeda(Number(insumo.custoUnitario) || custoCompra / conversao);
}

function criarCanal(
  canal: PrecificacaoCanal["canal"],
  precoVenda: number,
  taxaPercentual: number,
  embalagem: number,
  margemDesejada: number,
): PrecificacaoCanal {
  return {
    canal,
    cmvReal: 0,
    embalagem,
    lucroReal: 0,
    margemDesejada,
    margemReal: 0,
    precoMinimo: 0,
    precoSugerido: 0,
    precoVenda,
    taxaFixa: 0,
    taxaPercentual,
  };
}

export function moeda(valor: number) {
  return Math.round((Number.isFinite(valor) ? valor : 0) * 100) / 100;
}

export function percentual(valor: number) {
  return Math.round((Number.isFinite(valor) ? valor : 0) * 10) / 10;
}

export function converterQuantidade(quantidade: number, unidade: UnidadeMedidaPrecificacao) {
  if (unidade === "G") return quantidade / 1000;
  if (unidade === "ML") return quantidade / 1000;
  return quantidade;
}

export function calcularCustoMedioPonderado(
  estoqueAtualAntes: number,
  custoAtual: number,
  quantidadeComprada: number,
  custoCompra: number,
) {
  const totalQuantidade = estoqueAtualAntes + quantidadeComprada;

  if (totalQuantidade <= 0) {
    return moeda(custoCompra);
  }

  return moeda(((estoqueAtualAntes * custoAtual) + (quantidadeComprada * custoCompra)) / totalQuantidade);
}

export function calcularCustoFixoPorPedido(custos: CustosFixosPrecificacao) {
  const total =
    custos.aluguel +
    custos.energia +
    custos.agua +
    custos.internet +
    custos.salarios +
    custos.contador +
    custos.sistema +
    custos.marketing +
    custos.manutencao +
    custos.encargos +
    custos.outros;

  return moeda(total / Math.max(custos.pedidosMensais, 1));
}

export function calcularCustoIngrediente(ingrediente: Pick<ReceitaIngrediente, "custoUnitarioConvertido" | "quantidade" | "unidade">) {
  return moeda(ingrediente.custoUnitarioConvertido * ingrediente.quantidade);
}

export function atualizarIngredientesComEstoque(
  ingredientes: ReceitaIngrediente[],
  insumos: Pick<Insumo, "conversao" | "custoCompra" | "custoUnitario" | "id" | "nome" | "unidadeUso">[],
) {
  const insumosPorId = new Map(insumos.filter((insumo) => insumo.id).map((insumo) => [insumo.id, insumo]));

  return ingredientes.map((ingrediente) => {
    const insumo = insumosPorId.get(ingrediente.insumoId);
    if (!insumo) return ingrediente;

    const custoUnitarioConvertido = calcularCustoUnitarioUsoInsumo(insumo);
    return {
      ...ingrediente,
      custoTotal: moeda(ingrediente.quantidade * custoUnitarioConvertido),
      custoUnitarioConvertido,
      insumoNome: ingrediente.insumoNome || insumo.nome,
      unidade: normalizarUnidadePrecificacao(insumo.unidadeUso || ingrediente.unidade),
    };
  });
}

export function calcularStatus(cmv: number, margem: number, lucro: number, metas: MetaFinanceiraPrecificacao): StatusFinanceiroReceita {
  if (lucro < metas.lucroMinimo || cmv > metas.cmvMaximo + 8 || margem < metas.margemMinima - 8) {
    return "critico";
  }

  if (cmv > metas.cmvMaximo || margem < metas.margemMinima) {
    return "atencao";
  }

  return "saudavel";
}

export function recalcularReceita(
  receita: Partial<ReceitaPrecificacao>,
  custosFixos: CustosFixosPrecificacao = custosFixosPadrao,
  variaveis: CustosVariaveisPrecificacao = custosVariaveisPadrao,
  metas: MetaFinanceiraPrecificacao = metasPadrao,
): ReceitaPrecificacao {
  const precoOriginal = Math.max(Number(receita.precoVenda || 0), 0);
  const precoVenda = receita.congelarPreco ? Math.max(Number(receita.precoVenda || precoOriginal), 0) : precoOriginal;
  const ingredientes = receita.ingredientes || [];
  const custoIngredientesCalculado = moeda(ingredientes.reduce((acc, item) => acc + calcularCustoIngrediente(item), 0));
  const custoFixoRateado = moeda(calcularCustoFixoPorPedido(custosFixos));
  const taxas = moeda((precoVenda * (variaveis.taxaCartaoPercentual + variaveis.comissaoPercentual)) / 100);
  const custosVariaveis = moeda(
    variaveis.embalagem + variaveis.taxaDelivery + variaveis.cashback + variaveis.cupom + taxas,
  );
  const custoIngredientes = receita.congelarCusto ? Number(receita.custoIngredientes || custoIngredientesCalculado) : custoIngredientesCalculado;
  const custoTotalReal = moeda(custoIngredientes + custoFixoRateado + custosVariaveis);
  const lucro = moeda(precoVenda - custoTotalReal);
  const margem = precoVenda > 0 ? percentual((lucro / precoVenda) * 100) : 0;
  const cmvCalculado = precoVenda > 0 ? percentual((custoIngredientes / precoVenda) * 100) : 0;
  const cmv = receita.congelarCmv ? Number(receita.cmv || cmvCalculado) : cmvCalculado;
  const margemDesejada = Number(receita.margemDesejada || metas.margemDesejada || 35);
  const precoSugerido = moeda(custoTotalReal / (1 - Math.min(margemDesejada / 100, 0.9)));
  const canais = (receita.canais?.length ? receita.canais : canaisPadrao).map((canal) => calcularCanal(canal, custoIngredientes + custoFixoRateado));

  return {
    ativa: receita.ativa ?? true,
    canais,
    categoria: receita.categoria || "Hamburguer",
    cmv,
    congelarCmv: receita.congelarCmv ?? false,
    congelarCusto: receita.congelarCusto ?? false,
    congelarPreco: receita.congelarPreco ?? false,
    createdBy: receita.createdBy || "sistema",
    custoFixoRateado,
    custoIngredientes,
    custoTotalReal,
    custosVariaveis,
    descricao: receita.descricao || "",
    empresaId: receita.empresaId || "default",
    fracionado: receita.fracionado ?? false,
    globalEmpresa: receita.globalEmpresa ?? false,
    id: receita.id,
    imagemUrl: receita.imagemUrl,
    ingrediente: receita.ingrediente ?? false,
    ingredientes,
    lojaId: receita.lojaId,
    lucro,
    margem,
    margemDesejada,
    modoPreparo: receita.modoPreparo || "",
    nome: receita.nome || "Nova receita",
    observacoesInternas: receita.observacoesInternas || "",
    precoMinimo: custoTotalReal,
    precoPremium: moeda(precoSugerido * 1.14),
    precoSugerido,
    precoVenda,
    status: calcularStatus(cmv, margem, lucro, metas),
  } as ReceitaPrecificacao;
}

function calcularCanal(canal: PrecificacaoCanal, baseCusto: number): PrecificacaoCanal {
  const precoVenda = Math.max(canal.precoVenda, 0);
  const taxa = moeda((precoVenda * canal.taxaPercentual) / 100 + canal.taxaFixa);
  const custoTotal = moeda(baseCusto + taxa + canal.embalagem);
  const precoSugerido = moeda(custoTotal / (1 - Math.min(canal.margemDesejada / 100, 0.9)));
  const lucroReal = moeda(precoVenda - custoTotal);

  return {
    ...canal,
    cmvReal: precoVenda > 0 ? percentual((custoTotal / precoVenda) * 100) : 0,
    lucroReal,
    margemReal: precoVenda > 0 ? percentual((lucroReal / precoVenda) * 100) : 0,
    precoMinimo: custoTotal,
    precoSugerido,
  };
}

export function gerarAlertasFinanceiros(receitas: ReceitaPrecificacao[], metas: MetaFinanceiraPrecificacao) {
  return receitas.flatMap((receita) => {
    const alertas: string[] = [];

    if (receita.lucro < 0) alertas.push(`${receita.nome} esta com prejuizo.`);
    if (receita.cmv > metas.cmvMaximo) alertas.push(`${receita.nome} esta com CMV de ${receita.cmv.toFixed(1)}%.`);
    if (receita.margem < metas.margemMinima) alertas.push(`${receita.nome} esta abaixo da margem minima.`);
    if (receita.precoVenda < receita.precoMinimo) alertas.push(`${receita.nome} esta abaixo do preco minimo.`);
    if (receita.precoSugerido - receita.precoVenda >= 1) {
      alertas.push(`Recomendamos aumentar ${receita.nome} em R$ ${moeda(receita.precoSugerido - receita.precoVenda).toFixed(2)}.`);
    }

    return alertas;
  });
}

export function simularPreco(input: Pick<SimulacaoPreco, "custo" | "desconto" | "embalagem" | "margem" | "precoVenda" | "promocao" | "taxa">) {
  const custoTotal = moeda(input.custo + input.embalagem + input.desconto + input.promocao + (input.precoVenda * input.taxa) / 100);
  const lucro = moeda(input.precoVenda - custoTotal);
  const margem = input.precoVenda > 0 ? percentual((lucro / input.precoVenda) * 100) : 0;
  const cmv = input.precoVenda > 0 ? percentual((custoTotal / input.precoVenda) * 100) : 0;
  const risco = lucro < 0 || cmv > 45 ? "critico" : cmv > 32 || margem < input.margem ? "atencao" : "saudavel";

  return { cmv, custoTotal, lucro, margem, risco: risco as StatusFinanceiroReceita };
}

export async function listarReceitasPrecificacao(empresaId: string, lojaId?: string) {
  const filtros = [where("empresaId", "==", empresaId)];
  const receitasQuery = query(collection(db, PRECIFICACAO_COLLECTIONS.receitas), ...filtros);
  const snapshot = await getDocs(receitasQuery);
  const receitas = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ReceitaPrecificacao);

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
    throw new Error("Preco de venda precisa ser maior que zero.");
  }

  if (!receita.ingredientes.length) {
    throw new Error("Receita precisa ter pelo menos um ingrediente.");
  }

  if (!receita.empresaId) {
    throw new Error("empresaId e obrigatorio.");
  }

  if (!receita.globalEmpresa && !receita.lojaId) {
    throw new Error("lojaId e obrigatorio para receitas de loja.");
  }

  const id = receita.id || doc(collection(db, PRECIFICACAO_COLLECTIONS.receitas)).id;
  await setDoc(
    doc(db, PRECIFICACAO_COLLECTIONS.receitas, id),
    {
      ...receita,
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
    throw new Error("empresaId e lojaId sao obrigatorios para custos fixos.");
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
