import type { Insumo } from "../types";

export type OperationalStockItem = {
  id: string;
  nome: string;
  sku: string;
  codigoBarras: string;
  codigoBarrasNormalizado: string;
  marca: string;
  categoriaId: string;
  status: string;
  statusProduto: string;
  imagemUrl: string;
  imagemUploadUrl: string;
  imagemCosmosUrl: string;
  imagemPrincipal: string;
  quantidadeAtual: number;
  estoqueMinimo: number;
  estoqueMaximo: number;
  localArmazenamento: string;
  unidadeMedida: string;
  unidadeCompra: string;
  unidadeUso: string;
  conversao: number;
  fatorConversao: number;
  validadeOriginal: number;
  validadeAposAberto: number;
  validadeAposProducao: number;
  loteInterno: string;
  tipoEtiqueta: string;
};

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function createOperationalStockItem(id: string, data: Record<string, unknown>): OperationalStockItem {
  const quantidadeAtual = numberValue(data.quantidadeAtual ?? data.estoqueAtual);
  const unidadeMedida = textValue(data.unidadeMedida || data.unidadeUso || data.unidadeCompra || "unidade");

  return {
    id,
    nome: textValue(data.nome),
    sku: textValue(data.sku),
    codigoBarras: textValue(data.codigoBarras),
    codigoBarrasNormalizado: textValue(data.codigoBarrasNormalizado),
    marca: textValue(data.marca),
    categoriaId: textValue(data.categoriaId),
    status: textValue(data.status || "ativo"),
    statusProduto: textValue(data.statusProduto || "ativo"),
    imagemUrl: textValue(data.imagemUrl),
    imagemUploadUrl: textValue(data.imagemUploadUrl),
    imagemCosmosUrl: textValue(data.imagemCosmosUrl),
    imagemPrincipal: textValue(data.imagemPrincipal),
    quantidadeAtual,
    estoqueMinimo: numberValue(data.estoqueMinimo),
    estoqueMaximo: numberValue(data.estoqueMaximo),
    localArmazenamento: textValue(data.localArmazenamento),
    unidadeMedida,
    unidadeCompra: textValue(data.unidadeCompra || unidadeMedida),
    unidadeUso: textValue(data.unidadeUso || unidadeMedida),
    conversao: numberValue(data.conversao ?? data.fatorConversao) || 1,
    fatorConversao: numberValue(data.fatorConversao ?? data.conversao) || 1,
    validadeOriginal: numberValue(data.validadeOriginal),
    validadeAposAberto: numberValue(data.validadeAposAberto),
    validadeAposProducao: numberValue(data.validadeAposProducao),
    loteInterno: textValue(data.loteInterno),
    tipoEtiqueta: textValue(data.tipoEtiqueta),
  };
}

export function operationalStockItemToInsumo(item: OperationalStockItem): Insumo {
  return {
    ...item,
    estoqueAtual: item.quantidadeAtual,
    custoCompra: 0,
    custoUnitarioCompra: 0,
    custoUnitarioUso: 0,
    custoUnitario: 0,
    promocaoAtiva: false,
    frequenciaPedido: "",
    diasPedido: 0,
    diasEntrega: 0,
    quantidadePadraoPedido: 0,
    responsavel: "",
    observacao: "",
    precosVenda: [],
    margemEstimada: 0,
    cmv: 0,
    createdBy: "",
    criadoEm: null,
    atualizadoEm: null,
  };
}
