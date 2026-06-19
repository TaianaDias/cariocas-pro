import type { Insumo, XmlImport, XmlItem } from "../types";
import { buscarExterno } from "./barcode.service";
import { atualizarDocumento, consultar, criarDocumento, obterDocumento } from "./db";

const COLECAO = "importacoes_xml";

type XmlProcessItem = XmlItem & { acao: "criar" | "vincular" };

type ImportarArquivoXmlOptions = {
  arquivoNome: string;
  empresaId?: string;
  itens?: XmlItem[];
  lojaId?: string;
  uid: string;
};

type XmlNfeParseResult = {
  fornecedorCnpj: string;
  fornecedorNome: string;
  itens: XmlItem[];
};

function tagText(parent: Element | Document, tagName: string) {
  return parent.getElementsByTagName(tagName)[0]?.textContent?.trim() || "";
}

function xmlNumber(value: string) {
  return Number(value.replace(",", ".")) || 0;
}

function normalizarCodigo(value: string) {
  return value.trim() || `XML-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizarCodigoBarras(value: string) {
  const normalizado = value.replace(/\D/g, "");
  if (!normalizado || normalizado.length < 8) return "";
  return normalizado;
}

function hasCodigoValido(value: string) {
  const normalizado = value.trim().toUpperCase();
  return Boolean(normalizado && normalizado !== "SEM GTIN" && normalizado !== "SEMGTIN");
}

function tagCodigoValido(produto: Element, tagName: string) {
  const value = tagText(produto, tagName);
  return hasCodigoValido(value) ? value : "";
}

function extrairCodigosProduto(produto: Element) {
  const codigoBarras = normalizarCodigoBarras(tagCodigoValido(produto, "cEAN") || tagCodigoValido(produto, "cEANTrib"));
  const codigoProduto = tagCodigoValido(produto, "cProd");

  return {
    codigo: codigoBarras || normalizarCodigo(codigoProduto),
    codigoBarras,
    codigoBarrasNormalizado: codigoBarras,
    codigoProduto,
  };
}

export function parseNfeXml(xmlText: string): XmlNfeParseResult {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  const parserError = xml.getElementsByTagName("parsererror")[0];

  if (parserError) {
    throw new Error("XML invalido. Confira se o arquivo selecionado e uma NF-e em XML.");
  }

  const emitente = xml.getElementsByTagName("emit")[0];
  const fornecedorNome = emitente ? tagText(emitente, "xNome") : "";
  const fornecedorCnpj = emitente ? tagText(emitente, "CNPJ") || tagText(emitente, "CPF") : "";
  const detalhes = Array.from(xml.getElementsByTagName("det"));

  const itens = detalhes
    .map((detalhe) => detalhe.getElementsByTagName("prod")[0])
    .filter(Boolean)
    .map((produto) => {
      const codigos = extrairCodigosProduto(produto);
      const quantidade = xmlNumber(tagText(produto, "qCom") || tagText(produto, "qTrib"));
      const valorTotal = xmlNumber(tagText(produto, "vProd"));
      const valorUnitario = xmlNumber(tagText(produto, "vUnCom") || tagText(produto, "vUnTrib")) || (quantidade > 0 ? valorTotal / quantidade : 0);

      return {
        ...codigos,
        ncm: tagText(produto, "NCM"),
        nome: tagText(produto, "xProd"),
        quantidade,
        unidade: tagText(produto, "uCom") || tagText(produto, "uTrib") || "un",
        valorTotal,
        valorUnitario,
      };
    })
    .filter((item) => item.nome && item.quantidade > 0);

  if (!itens.length) {
    throw new Error("Nenhum item de produto foi encontrado no XML da nota.");
  }

  return {
    fornecedorCnpj,
    fornecedorNome: fornecedorNome || "Fornecedor XML",
    itens,
  };
}

export async function criarImportacao(dados: Omit<XmlImport, "id" | "criadoEm">, uid: string): Promise<string> {
  try {
    return criarDocumento(COLECAO, { ...dados, createdBy: uid });
  } catch (error) {
    console.error("Erro ao criar importacao XML", error);
    throw error;
  }
}

export const criarXmlImport = criarImportacao;

export async function listarImportacoes(): Promise<XmlImport[]> {
  try {
    return consultar<XmlImport>(COLECAO, [], { campo: "criadoEm", direcao: "desc" });
  } catch (error) {
    console.error("Erro ao listar importacoes XML", error);
    return [];
  }
}

export const listarXmlImports = listarImportacoes;

export async function getImportacao(id: string): Promise<XmlImport | null> {
  try {
    return obterDocumento<XmlImport>(COLECAO, id);
  } catch (error) {
    console.error("Erro ao buscar importacao XML", error);
    return null;
  }
}

export const buscarXmlImport = getImportacao;

export async function processarLoteXml(
  itens: XmlProcessItem[],
  uid: string,
  importacaoId: string,
  contexto?: { empresaId?: string; fornecedorCnpj?: string; fornecedorNome?: string; lojaId?: string },
): Promise<{ criados: number; vinculados: number; erros: string[] }> {
  const erros: string[] = [];
  let criados = 0;
  let vinculados = 0;

  for (const item of itens) {
    try {
      const codigoBusca = item.codigoBarrasNormalizado || normalizarCodigoBarras(item.codigoBarras || item.codigo);
      const buscas = item.produtoExistenteId
        ? []
        : [
            ...(codigoBusca ? [{ campo: "codigoBarrasNormalizado", operador: "==" as const, valor: codigoBusca }] : []),
            ...(hasCodigoValido(item.codigoBarras || "") ? [{ campo: "codigoBarras", operador: "==" as const, valor: item.codigoBarras }] : []),
            ...(hasCodigoValido(item.codigo || "") ? [{ campo: "codigoBarras", operador: "==" as const, valor: item.codigo }] : []),
          ];
      let existentes: Insumo[] = [];
      for (const filtro of buscas) {
        existentes = await consultar<Insumo>(
          "insumos",
          [
            ...(contexto?.empresaId ? [{ campo: "empresaId", operador: "==" as const, valor: contexto.empresaId }] : []),
            ...(contexto?.lojaId ? [{ campo: "lojaId", operador: "==" as const, valor: contexto.lojaId }] : []),
            filtro,
          ],
          undefined,
          1,
        );
        if (existentes.length) break;
      }
      const produtoExistenteId = item.produtoExistenteId || existentes[0]?.id;

      if (item.acao === "vincular" || produtoExistenteId) {
        const produto = produtoExistenteId ? await obterDocumento<Insumo>("insumos", produtoExistenteId) : null;
        if (!produto || !produtoExistenteId) {
          throw new Error("Produto existente nao encontrado para vinculo.");
        }

        const quantidadeAtual = Number(produto.quantidadeAtual) || 0;
        const custoAtual = Number(produto.custoCompra) || 0;
        const novaQuantidade = quantidadeAtual + item.quantidade;
        const novoCusto = novaQuantidade > 0
          ? Math.round(((quantidadeAtual * custoAtual + item.valorTotal) / novaQuantidade) * 100) / 100
          : item.valorUnitario;
        const imagemAtual = produto.imagemUrl || produto.imagemPrincipal || produto.imagemUploadUrl || produto.imagemCosmosUrl || "";
        const produtoExterno = imagemAtual ? null : await buscarExterno(item.codigo);
        const imagemUrl = produtoExterno?.imagemUrl || "";

        await atualizarDocumento<Insumo>("insumos", produtoExistenteId, {
          custoAnterior: custoAtual,
          custoCompra: novoCusto,
          custoUnitario: novoCusto,
          empresaId: contexto?.empresaId || produto.empresaId,
          fornecedorPrincipal: contexto?.fornecedorNome || produto.fornecedorPrincipal,
          ...(imagemUrl ? { imagemPrincipal: imagemUrl, imagemUrl } : {}),
          lojaId: contexto?.lojaId || produto.lojaId,
          quantidadeAtual: novaQuantidade,
        });

        await criarDocumento("historico", {
          custoTotal: item.valorTotal,
          custoUnitario: item.valorUnitario,
          empresaId: contexto?.empresaId,
          fornecedorId: contexto?.fornecedorCnpj || "",
          insumoId: produtoExistenteId,
          insumoNome: produto.nome,
          observacao: `Entrada por XML - ${importacaoId}`,
          quantidade: item.quantidade,
          responsavel: uid,
          tipo: "xml",
          unidade: item.unidade,
          lojaId: contexto?.lojaId,
          xmlId: importacaoId,
        });

        vinculados++;
      } else if (item.acao === "criar") {
        const codigoBarras = item.codigoBarras || item.codigoBarrasNormalizado || "";
        const codigoBarrasNormalizado = item.codigoBarrasNormalizado || normalizarCodigoBarras(codigoBarras);
        const produtoExterno = await buscarExterno(codigoBarrasNormalizado || item.codigo);
        const imagemUrl = produtoExterno?.imagemUrl || "";
        const novoInsumo = {
          nome: item.nome,
          sku: `XML-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          marca: contexto?.fornecedorNome || "",
          categoriaId: "",
          codigoBarras: codigoBarras || item.codigo,
          codigoBarrasNormalizado,
          codigoInterno: item.codigoProduto || "",
          cmv: 0,
          custoUnitario: item.valorUnitario,
          status: "ativo",
          statusProduto: "ativo",
          quantidadeAtual: item.quantidade,
          estoqueMinimo: 0,
          estoqueMaximo: 0,
          localArmazenamento: "",
          unidadeMedida: item.unidade,
          unidadeCompra: item.unidade,
          unidadeUso: item.unidade,
          conversao: 1,
          custoCompra: item.valorUnitario,
          promocaoAtiva: false,
          validadeOriginal: 0,
          validadeAposAberto: 0,
          validadeAposProducao: 0,
          loteInterno: "",
          frequenciaPedido: "",
          imagemPrincipal: imagemUrl,
          imagemUrl,
          diasPedido: 0,
          diasEntrega: 0,
          quantidadePadraoPedido: 0,
          responsavel: uid,
          observacao: `Importado via XML - ${importacaoId}`,
          tipoEtiqueta: "",
          precosVenda: [],
          margemEstimada: 0,
          nomeNormalizado: item.nome.toLowerCase(),
          origemCadastro: "xml",
          createdBy: uid,
          empresaId: contexto?.empresaId,
          lojaId: contexto?.lojaId,
        };

        const insumoId = await criarDocumento("insumos", novoInsumo);
        await criarDocumento("historico", {
          custoTotal: item.valorTotal,
          custoUnitario: item.valorUnitario,
          empresaId: contexto?.empresaId,
          fornecedorId: contexto?.fornecedorCnpj || "",
          insumoId,
          insumoNome: item.nome,
          observacao: `Criado por XML - ${importacaoId}`,
          quantidade: item.quantidade,
          responsavel: uid,
          tipo: "xml",
          unidade: item.unidade,
          lojaId: contexto?.lojaId,
          xmlId: importacaoId,
        });
        criados++;
      }
    } catch (error) {
      erros.push(`Erro ao processar ${item.nome}: ${error}`);
    }
  }

  return { criados, vinculados, erros };
}

export async function importarArquivoXml(xmlText: string, options: ImportarArquivoXmlOptions) {
  const parseado = parseNfeXml(xmlText);
  const itens = options.itens?.length ? options.itens : parseado.itens;
  const itensProcessamento = itens.map((item) => ({ ...item, acao: "criar" as const }));

  const importacaoId = await criarImportacao(
    {
      arquivoNome: options.arquivoNome,
      createdBy: options.uid,
      fornecedorCnpj: parseado.fornecedorCnpj,
      fornecedorNome: parseado.fornecedorNome,
      empresaId: options.empresaId,
      itens,
      itensCriados: 0,
      itensVinculados: 0,
      totalItens: itens.length,
      lojaId: options.lojaId,
    },
    options.uid,
  );

  const resultado = await processarLoteXml(itensProcessamento, options.uid, importacaoId, {
    empresaId: options.empresaId,
    fornecedorCnpj: parseado.fornecedorCnpj,
    fornecedorNome: parseado.fornecedorNome,
    lojaId: options.lojaId,
  });

  await atualizarDocumento<XmlImport>(COLECAO, importacaoId, {
    itensCriados: resultado.criados,
    itensVinculados: resultado.vinculados,
  });

  return {
    ...resultado,
    arquivoNome: options.arquivoNome,
    fornecedorCnpj: parseado.fornecedorCnpj,
    fornecedorNome: parseado.fornecedorNome,
    importacaoId,
    itens,
    totalItens: itens.length,
  };
}
