import type { Insumo, XmlImport, XmlItem } from "../types";
import { consultar, criarDocumento, obterDocumento } from "./db";

const COLECAO = "importacoes_xml";

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
  itens: (XmlItem & { acao: "criar" | "vincular" })[],
  uid: string,
  importacaoId: string,
): Promise<{ criados: number; vinculados: number; erros: string[] }> {
  const erros: string[] = [];
  let criados = 0;
  let vinculados = 0;

  for (const item of itens) {
    try {
      if (item.acao === "criar") {
        const novoInsumo: Omit<Insumo, "id" | "criadoEm" | "atualizadoEm"> = {
          nome: item.nome,
          sku: `XML-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          marca: "",
          categoriaId: "",
          codigoBarras: item.codigo,
          status: "ativo",
          quantidadeAtual: 0,
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
          diasPedido: 0,
          diasEntrega: 0,
          quantidadePadraoPedido: 0,
          responsavel: uid,
          observacao: `Importado via XML - ${importacaoId}`,
          tipoEtiqueta: "",
          precosVenda: [],
          margemEstimada: 0,
          cmv: 0,
          createdBy: uid,
        };

        await criarDocumento("insumos", novoInsumo);
        criados++;
      } else if (item.acao === "vincular" && item.produtoExistenteId) {
        vinculados++;
      }
    } catch (error) {
      erros.push(`Erro ao processar ${item.nome}: ${error}`);
    }
  }

  return { criados, vinculados, erros };
}
