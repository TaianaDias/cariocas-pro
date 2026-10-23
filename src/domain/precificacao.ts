import type {
  CustosFixosPrecificacao,
  CustosVariaveisPrecificacao,
  Insumo,
  MetaFinanceiraPrecificacao,
  PrecificacaoCanal,
  ReceitaIngrediente,
  ReceitaPrecificacao,
  SimulacaoPreco,
  StatusFinanceiroReceita,
  UnidadeMedidaPrecificacao,
} from "../types";

import { resolverCustoInsumo, converterUnidade, precisaoCusto } from "./custos";

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

export function calcularCustoUnitarioUsoInsumo(insumo: Partial<Insumo>) {
  return resolverCustoInsumo(insumo).valor;
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
  return Number.isFinite(valor) ? Math.sign(valor) * Math.round((Math.abs(valor) + Number.EPSILON) * 100) / 100 : 0;
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

  return precisaoCusto(((estoqueAtualAntes * custoAtual) + (quantidadeComprada * custoCompra)) / totalQuantidade);
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
  const custo = ingrediente.custoUnitarioConvertido;
  if (custo === null || !Number.isFinite(custo) || custo < 0 || !Number.isFinite(ingrediente.quantidade) || ingrediente.quantidade <= 0) return null;
  return custo * ingrediente.quantidade;
}

export function atualizarIngredientesComEstoque(ingredientes: ReceitaIngrediente[], insumos: Partial<Insumo>[]) {
  const porId = new Map(insumos.filter((item) => item.id).map((item) => [item.id, item]));
  return ingredientes.map((ingrediente) => {
    const insumo = porId.get(ingrediente.insumoId);
    const custo = insumo ? resolverCustoInsumo(insumo) : null;
    const quantidadeUso = insumo ? converterUnidade(ingrediente.quantidade, ingrediente.unidade, insumo.unidadeUso || "") : null;
    const motivo = ingrediente.tipo === "receita_base"
      ? "Preparação intermediária exige cálculo de dependências, ainda pendente nesta etapa."
      : !insumo ? "Insumo não encontrado nesta loja."
      : custo?.motivo || (quantidadeUso === null ? "Unidade da ficha incompatível com a unidade de uso do insumo." : null);
    const unitario = motivo || custo?.valor == null || quantidadeUso === null || ingrediente.quantidade <= 0
      ? null : precisaoCusto(custo.valor * quantidadeUso / ingrediente.quantidade);
    return {
      ...ingrediente,
      custoUnitarioConvertido: unitario,
      custoTotal: unitario === null ? null : moeda(unitario * ingrediente.quantidade),
      custoOrigem: custo?.fonte || "ausente",
      custoInformadoEm: custo?.informadoEm || null,
      custoPendencia: motivo,
    };
  });
}

export function calcularStatus(cmv: number | null, margem: number | null, lucro: number | null, metas: MetaFinanceiraPrecificacao): StatusFinanceiroReceita {
  if (cmv === null || margem === null || lucro === null) return "pendente";
  if (lucro < 0 || margem < metas.margemMinima) return "critico";
  if (cmv > metas.cmvMaximo || lucro < metas.lucroMinimo || margem < metas.margemDesejada) return "atencao";
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
  const valores = ingredientes.map(calcularCustoIngrediente);
  const custoPendencias = ingredientes.flatMap((item, index) => valores[index] === null ? [`${item.insumoNome}: ${item.custoPendencia || "custo ou quantidade inválidos"}`] : []);
  if (!ingredientes.length) custoPendencias.push("Ficha sem ingredientes.");
  const custoIngredientesCalculado = custoPendencias.length ? null : moeda(valores.reduce<number>((acc, item) => acc + (item ?? 0), 0));
  const custoFixoRateado = moeda(calcularCustoFixoPorPedido(custosFixos));
  const taxas = moeda((precoVenda * (variaveis.taxaCartaoPercentual + variaveis.comissaoPercentual)) / 100);
  const custosVariaveis = moeda(
    variaveis.embalagem + variaveis.taxaDelivery + variaveis.cashback + variaveis.cupom + taxas,
  );
  const custoIngredientes = custoIngredientesCalculado === null ? null : receita.congelarCusto ? (receita.custoIngredientes ?? custoIngredientesCalculado) : custoIngredientesCalculado;
  const custoTotalReal = custoIngredientes === null ? null : moeda(custoIngredientes + custoFixoRateado + custosVariaveis);
  const lucro = custoTotalReal === null ? null : moeda(precoVenda - custoTotalReal);
  const margem = lucro === null ? null : precoVenda > 0 ? percentual((lucro / precoVenda) * 100) : null;
  const cmvCalculado = custoIngredientes === null ? null : precoVenda > 0 ? percentual((custoIngredientes / precoVenda) * 100) : null;
  const cmv = cmvCalculado === null ? null : receita.congelarCmv ? (receita.cmv ?? cmvCalculado) : cmvCalculado;
  const margemDesejada = Number(receita.margemDesejada ?? metas.margemDesejada ?? 35);
  const percentualTaxas = (variaveis.taxaCartaoPercentual + variaveis.comissaoPercentual) / 100;
  const denominador = 1 - margemDesejada / 100 - percentualTaxas;
  const baseSemTaxas = custoIngredientes === null ? null : custoIngredientes + custoFixoRateado + variaveis.embalagem + variaveis.taxaDelivery + variaveis.cashback + variaveis.cupom;
  const precoSugerido = baseSemTaxas === null || denominador <= 0 ? null : moeda(baseSemTaxas / denominador);
  const canais = custoIngredientes === null ? [] : (receita.canais?.length ? receita.canais : canaisPadrao).map((canal) => calcularCanal(canal, custoIngredientes, custoFixoRateado));

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
    custoSituacao: custoPendencias.length ? "pendente" : "estimado",
    custoPendencias,
    versaoFicha: receita.versaoFicha ?? 0,
    custoTotalReal,
    custosVariaveis,
    custoCmv: custoIngredientes,
    descricao: receita.descricao || "",
    empresaId: receita.empresaId || "default",
    fracionado: receita.fracionado ?? false,
    globalEmpresa: receita.globalEmpresa ?? false,
    id: receita.id,
    imagemUrl: receita.imagemUrl,
    ingrediente: receita.ingrediente ?? false,
    ingredientes,
    fichaTecnicaIngredientes: ingredientes.map((ingrediente) => ({
      insumoId: ingrediente.insumoId,
      nome: ingrediente.insumoNome,
      quantidade: ingrediente.quantidade,
      unidade: ingrediente.unidade,
    })),
    lojaId: receita.lojaId,
    lucro,
    margem,
    margemDesejada,
    modoPreparo: receita.modoPreparo || "",
    nome: receita.nome || "Nova receita",
    observacoesInternas: receita.observacoesInternas || "",
    precoMinimo: baseSemTaxas === null || percentualTaxas >= 1 ? null : moeda(baseSemTaxas / (1 - percentualTaxas)),
    precoPremium: precoSugerido === null ? null : moeda(precoSugerido * 1.14),
    precoSugerido,
    precoVenda,
    status: calcularStatus(cmv, margem, lucro, metas),
  } as ReceitaPrecificacao;
}

function calcularCanal(canal: PrecificacaoCanal, ingredientes: number, fixos: number): PrecificacaoCanal {
  const baseCusto = ingredientes + fixos;
  const precoVenda = Math.max(canal.precoVenda, 0);
  const taxa = moeda((precoVenda * canal.taxaPercentual) / 100 + canal.taxaFixa);
  const custoTotal = moeda(baseCusto + taxa + canal.embalagem);
  const denominador = 1 - (canal.margemDesejada + canal.taxaPercentual) / 100;
  const precoSugerido = denominador > 0 ? moeda((baseCusto + canal.taxaFixa + canal.embalagem) / denominador) : null;
  const lucroReal = moeda(precoVenda - custoTotal);

  return {
    ...canal,
    cmvReal: precoVenda > 0 ? percentual((ingredientes / precoVenda) * 100) : null,
    lucroReal: precoVenda > 0 ? lucroReal : null,
    margemReal: precoVenda > 0 ? percentual((lucroReal / precoVenda) * 100) : null,
    precoMinimo: canal.taxaPercentual >= 100 ? null : moeda((baseCusto + canal.taxaFixa + canal.embalagem) / (1 - canal.taxaPercentual / 100)),
    precoSugerido,
  };
}

export function gerarAlertasFinanceiros(receitas: ReceitaPrecificacao[], metas: MetaFinanceiraPrecificacao) {
  return receitas.flatMap((receita) => {
    const alertas: string[] = [];
    if (receita.custoSituacao === "pendente") return [`${receita.nome}: custos pendentes. CMV, margem e sugestão de preço indisponíveis.`];

    if (receita.lucro !== null && receita.lucro < 0) alertas.push(`${receita.nome} esta com prejuizo.`);
    if (receita.cmv !== null && receita.cmv > metas.cmvMaximo) alertas.push(`${receita.nome} esta com CMV de ${receita.cmv.toFixed(1)}%.`);
    if (receita.margem !== null && receita.margem < metas.margemMinima) alertas.push(`${receita.nome} esta abaixo da margem minima.`);
    if (receita.precoMinimo !== null && receita.precoVenda < receita.precoMinimo) alertas.push(`${receita.nome} esta abaixo do preco minimo.`);
    if (receita.precoSugerido !== null && receita.precoSugerido - receita.precoVenda >= 1) {
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
