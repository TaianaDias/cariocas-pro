import type { Insumo, ProducaoPorcao } from "../types";
import { atualizarDocumento, consultar, criarDocumento, obterDocumento } from "./db";
import { listarInsumos } from "./estoque.service";
import { registrarHistorico } from "./historico.service";

const COLECAO_PORCOES = "porcoes_producao";
const COLECAO_INSUMOS = "insumos";

type SaidaParaProducaoInput = {
  area?: string;
  insumoNome: string;
  observacao?: string;
  porcoes: number;
  quantidade: number;
  responsavel: string;
  unidade: string;
};

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function converterQuantidade(quantidade: number, unidadeOrigem: string, unidadeDestino: string) {
  const origem = normalizar(unidadeOrigem);
  const destino = normalizar(unidadeDestino);

  if (origem === destino) return quantidade;
  if ((origem === "g" || origem === "grama" || origem === "gramas") && destino === "kg") return quantidade / 1000;
  if (origem === "kg" && (destino === "g" || destino === "grama" || destino === "gramas")) return quantidade * 1000;
  if (origem === "ml" && (destino === "l" || destino === "lt" || destino === "litro" || destino === "litros")) return quantidade / 1000;
  if ((origem === "l" || origem === "lt" || origem === "litro" || origem === "litros") && destino === "ml") return quantidade * 1000;

  return quantidade;
}

async function buscarInsumoPorNome(nome: string): Promise<Insumo | null> {
  const resultados = await listarInsumos({ busca: nome });
  const alvo = normalizar(nome);

  return (
    resultados.find((insumo) => normalizar(insumo.nome) === alvo) ||
    resultados.find((insumo) => normalizar(insumo.nome).includes(alvo) || alvo.includes(normalizar(insumo.nome))) ||
    null
  );
}

export async function registrarSaidaParaProducao(input: SaidaParaProducaoInput): Promise<ProducaoPorcao> {
  try {
    if (!input.insumoNome.trim()) throw new Error("Informe o nome do insumo.");
    if (input.quantidade <= 0) throw new Error("A quantidade precisa ser maior que zero.");
    if (input.porcoes <= 0) throw new Error("A quantidade de porcoes precisa ser maior que zero.");

    const insumo = await buscarInsumoPorNome(input.insumoNome);
    if (!insumo?.id) {
      throw new Error(`Nao encontrei o insumo "${input.insumoNome}" no estoque.`);
    }

    const quantidadeBaixa = converterQuantidade(input.quantidade, input.unidade, insumo.unidadeMedida);

    if (insumo.quantidadeAtual < quantidadeBaixa) {
      throw new Error(
        `Estoque insuficiente. Disponivel: ${insumo.quantidadeAtual} ${insumo.unidadeMedida}; solicitado: ${quantidadeBaixa} ${insumo.unidadeMedida}.`,
      );
    }

    const novoSaldo = Math.max(0, insumo.quantidadeAtual - quantidadeBaixa);
    const custoTotal = quantidadeBaixa * insumo.custoCompra;
    const custoPorPorcao = custoTotal / input.porcoes;

    await atualizarDocumento<Insumo>(COLECAO_INSUMOS, insumo.id, {
      quantidadeAtual: novoSaldo,
    });

    const producao: Omit<ProducaoPorcao, "id" | "criadoEm" | "atualizadoEm"> = {
      insumoId: insumo.id,
      insumoNome: insumo.nome,
      quantidadeBaixada: quantidadeBaixa,
      unidade: insumo.unidadeMedida,
      porcoesGeradas: input.porcoes,
      porcoesDisponiveis: input.porcoes,
      area: input.area || "producao",
      custoUnitario: insumo.custoCompra,
      custoTotal,
      custoPorPorcao,
      responsavel: input.responsavel,
      observacao: input.observacao || "Saida do estoque para producao registrada via WhatsApp",
      status: "disponivel",
    };

    const id = await criarDocumento(COLECAO_PORCOES, producao);

    await registrarHistorico({
      tipo: "saida_producao",
      insumoId: insumo.id,
      insumoNome: insumo.nome,
      quantidade: -quantidadeBaixa,
      custoUnitario: insumo.custoCompra,
      custoTotal,
      observacao: `${input.porcoes} porcoes geradas para ${producao.area}`,
      responsavel: input.responsavel,
    });

    return {
      id,
      ...producao,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
  } catch (error) {
    console.error("Erro ao registrar saida para producao", error);
    throw error;
  }
}

export async function listarPorcoesDisponiveis(): Promise<ProducaoPorcao[]> {
  try {
    return consultar<ProducaoPorcao>(
      COLECAO_PORCOES,
      [{ campo: "porcoesDisponiveis", operador: ">" as const, valor: 0 }],
      { campo: "criadoEm", direcao: "desc" },
    );
  } catch (error) {
    console.error("Erro ao listar porcoes disponiveis", error);
    return [];
  }
}

export async function getProducaoPorcao(id: string): Promise<ProducaoPorcao | null> {
  try {
    return obterDocumento<ProducaoPorcao>(COLECAO_PORCOES, id);
  } catch (error) {
    console.error("Erro ao buscar producao de porcoes", error);
    return null;
  }
}
