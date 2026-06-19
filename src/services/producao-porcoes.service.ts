import type { Insumo, ProducaoPorcao } from "../types";
import { atualizarDocumento, criarDocumento, deletarDocumento, obterDocumento, obterTodos } from "./db";
import { listarInsumos } from "./estoque.service";
import { registrarHistorico } from "./historico.service";

const COLECAO_PORCOES = "porcoes_producao";
const COLECAO_INSUMOS = "insumos";

type SaidaParaProducaoInput = {
  area?: string;
  empresaId?: string;
  formatoPorcao?: string;
  insumoId?: string;
  insumoNome: string;
  lojaId?: string;
  observacao?: string;
  porcoes: number;
  quantidadePorPorcao?: number;
  quantidade: number;
  responsavel: string;
  unidade: string;
  unidadePorcao?: string;
};

type AtualizarPorcaoInput = {
  area?: string;
  empresaId?: string;
  formatoPorcao?: string;
  lojaId?: string;
  observacao?: string;
  porcoesDisponiveis?: number;
  porcoesGeradas?: number;
  quantidadePorPorcao?: number;
  unidadePorcao?: string;
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

type TenantContext = {
  empresaId?: string;
  lojaId?: string;
};

async function buscarInsumoPorNome(nome: string, context?: TenantContext): Promise<Insumo | null> {
  const resultados = await listarInsumos({ busca: nome, empresaId: context?.empresaId, lojaId: context?.lojaId });
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

    const insumo = input.insumoId
      ? await obterDocumento<Insumo>(COLECAO_INSUMOS, input.insumoId)
      : await buscarInsumoPorNome(input.insumoNome, input);
    if (!insumo?.id) {
      throw new Error(`Nao encontrei o insumo "${input.insumoNome}" no estoque.`);
    }
    if (input.empresaId && insumo.empresaId && insumo.empresaId !== input.empresaId) {
      throw new Error("Este insumo nao pertence a empresa atual.");
    }
    if (input.lojaId && insumo.lojaId && insumo.lojaId !== input.lojaId) {
      throw new Error("Este insumo nao pertence a loja atual.");
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
      empresaId: input.empresaId || insumo.empresaId,
      lojaId: input.lojaId || insumo.lojaId,
      insumoId: insumo.id,
      insumoNome: insumo.nome,
      quantidadeBaixada: quantidadeBaixa,
      unidade: insumo.unidadeMedida,
      formatoPorcao: input.formatoPorcao || "porcao",
      quantidadePorPorcao: input.quantidadePorPorcao || (input.porcoes > 0 ? quantidadeBaixa / input.porcoes : 0),
      unidadePorcao: input.unidadePorcao || insumo.unidadeMedida,
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
      empresaId: input.empresaId || insumo.empresaId,
      lojaId: input.lojaId || insumo.lojaId,
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

export async function listarPorcoesDisponiveis(context?: TenantContext): Promise<ProducaoPorcao[]> {
  try {
    const porcoes = await obterTodos<ProducaoPorcao>(COLECAO_PORCOES);
    return porcoes
      .filter((porcao) => {
        const pertenceEmpresa = !context?.empresaId || porcao.empresaId === context.empresaId;
        const pertenceLoja = !context?.lojaId || porcao.lojaId === context.lojaId;
        return pertenceEmpresa && pertenceLoja && Number(porcao.porcoesDisponiveis) > 0;
      })
      .sort((a, b) => {
        const dataA = a.criadoEm && typeof a.criadoEm === "object" && "toDate" in a.criadoEm ? (a.criadoEm as { toDate: () => Date }).toDate().getTime() : 0;
        const dataB = b.criadoEm && typeof b.criadoEm === "object" && "toDate" in b.criadoEm ? (b.criadoEm as { toDate: () => Date }).toDate().getTime() : 0;
        return dataB - dataA;
      });
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

export async function atualizarProducaoPorcao(id: string, dados: AtualizarPorcaoInput): Promise<void> {
  try {
    const porcaoAtual = await obterDocumento<ProducaoPorcao>(COLECAO_PORCOES, id);
    if (!porcaoAtual) throw new Error("Porcao nao encontrada.");
    if (dados.empresaId && porcaoAtual.empresaId && porcaoAtual.empresaId !== dados.empresaId) {
      throw new Error("Esta porcao nao pertence a empresa atual.");
    }
    if (dados.lojaId && porcaoAtual.lojaId && porcaoAtual.lojaId !== dados.lojaId) {
      throw new Error("Esta porcao nao pertence a loja atual.");
    }

    const porcoesGeradas = Number(dados.porcoesGeradas ?? porcaoAtual.porcoesGeradas) || 0;
    const porcoesDisponiveis = Number(dados.porcoesDisponiveis ?? porcaoAtual.porcoesDisponiveis) || 0;

    if (porcoesGeradas <= 0) throw new Error("A quantidade gerada precisa ser maior que zero.");
    if (porcoesDisponiveis < 0) throw new Error("Porcoes disponiveis nao pode ser negativo.");
    if (porcoesDisponiveis > porcoesGeradas) throw new Error("Porcoes disponiveis nao pode ser maior que porcoes geradas.");

    const status: ProducaoPorcao["status"] = porcoesDisponiveis <= 0 ? "finalizado" : porcoesDisponiveis < porcoesGeradas ? "parcial" : "disponivel";

    await atualizarDocumento<ProducaoPorcao>(COLECAO_PORCOES, id, {
      area: dados.area || porcaoAtual.area,
      formatoPorcao: dados.formatoPorcao || porcaoAtual.formatoPorcao,
      observacao: dados.observacao ?? porcaoAtual.observacao,
      porcoesDisponiveis,
      porcoesGeradas,
      quantidadePorPorcao: Number(dados.quantidadePorPorcao ?? porcaoAtual.quantidadePorPorcao) || 0,
      status,
      unidadePorcao: dados.unidadePorcao || porcaoAtual.unidadePorcao || porcaoAtual.unidade,
    });
  } catch (error) {
    console.error("Erro ao atualizar porcao de producao", error);
    throw error;
  }
}

export async function deletarProducaoPorcao(id: string, context?: TenantContext): Promise<void> {
  try {
    const porcaoAtual = await obterDocumento<ProducaoPorcao>(COLECAO_PORCOES, id);
    if (!porcaoAtual) throw new Error("Porcao nao encontrada.");
    if (context?.empresaId && porcaoAtual.empresaId && porcaoAtual.empresaId !== context.empresaId) {
      throw new Error("Esta porcao nao pertence a empresa atual.");
    }
    if (context?.lojaId && porcaoAtual.lojaId && porcaoAtual.lojaId !== context.lojaId) {
      throw new Error("Esta porcao nao pertence a loja atual.");
    }
    await deletarDocumento(COLECAO_PORCOES, id);
  } catch (error) {
    console.error("Erro ao excluir porcao de producao", error);
    throw error;
  }
}
