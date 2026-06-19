import type { Insumo, ProducaoPorcao } from "../types";
import { atualizarDocumento, criarDocumento, deletarDocumento, obterDocumento, obterTodos } from "./db";
import { getHistoricoEstoqueCollectionPath, getInsumosCollectionPath, listarInsumos, normalizarInsumoFinanceiro } from "./estoque.service";

const COLECAO_PORCOES = "porcoes_producao";

function getPorcoesCollectionPath(empresaId?: string) {
  return empresaId ? `empresas/${empresaId}/porcoesProducao` : COLECAO_PORCOES;
}

type SaidaParaProducaoInput = {
  area?: string;
  empresaId?: string;
  formatoPorcao?: string;
  insumoId?: string;
  insumoNome: string;
  insumoPorcionadoId?: string;
  insumoPorcionadoNome?: string;
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
      ? (await obterDocumento<Insumo>(getInsumosCollectionPath(input.empresaId), input.insumoId)) ||
        (await obterDocumento<Insumo>("insumos", input.insumoId))
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

    const insumoPorcionado = input.insumoPorcionadoId
      ? (await obterDocumento<Insumo>(getInsumosCollectionPath(input.empresaId), input.insumoPorcionadoId)) ||
        (await obterDocumento<Insumo>("insumos", input.insumoPorcionadoId))
      : null;

    const quantidadeBaixa = converterQuantidade(input.quantidade, input.unidade, insumo.unidadeMedida);

    if ((Number(insumo.estoqueAtual ?? insumo.quantidadeAtual) || 0) < quantidadeBaixa) {
      throw new Error(
        `Estoque insuficiente. Disponivel: ${Number(insumo.estoqueAtual ?? insumo.quantidadeAtual) || 0} ${insumo.unidadeMedida}; solicitado: ${quantidadeBaixa} ${insumo.unidadeMedida}.`,
      );
    }

    const saldoBrutoAtual = Number(insumo.estoqueAtual ?? insumo.quantidadeAtual) || 0;
    const novoSaldo = Math.max(0, saldoBrutoAtual - quantidadeBaixa);
    const custoUnitarioUsoBruto = Number(insumo.custoUnitarioUso ?? insumo.custoUnitario ?? insumo.custoCompra) || 0;
    const custoTotal = quantidadeBaixa * custoUnitarioUsoBruto;
    const custoPorPorcao = custoTotal / input.porcoes;

    await atualizarDocumento<Insumo>(getInsumosCollectionPath(input.empresaId), insumo.id, normalizarInsumoFinanceiro({
      ...insumo,
      empresaId: input.empresaId || insumo.empresaId,
      lojaId: input.lojaId || insumo.lojaId,
      estoqueAtual: novoSaldo,
      quantidadeAtual: novoSaldo,
    }));

    if (insumoPorcionado?.id) {
      const estoquePorcionadoAtual = Number(insumoPorcionado.estoqueAtual ?? insumoPorcionado.quantidadeAtual) || 0;
      const novoEstoquePorcionado = estoquePorcionadoAtual + input.porcoes;
      await atualizarDocumento<Insumo>(getInsumosCollectionPath(input.empresaId), insumoPorcionado.id, normalizarInsumoFinanceiro({
        ...insumoPorcionado,
        custoUnitarioCompra: custoPorPorcao,
        custoUnitarioUso: custoPorPorcao,
        empresaId: input.empresaId || insumoPorcionado.empresaId,
        estoqueAtual: novoEstoquePorcionado,
        lojaId: input.lojaId || insumoPorcionado.lojaId,
        quantidadeAtual: novoEstoquePorcionado,
      }));
    }

    const producao: Omit<ProducaoPorcao, "id" | "criadoEm" | "atualizadoEm"> = {
      empresaId: input.empresaId || insumo.empresaId,
      lojaId: input.lojaId || insumo.lojaId,
      insumoId: insumo.id,
      insumoNome: insumo.nome,
      insumoBrutoId: insumo.id,
      insumoBrutoNome: insumo.nome,
      insumoPorcionadoId: insumoPorcionado?.id || input.insumoPorcionadoId || "",
      insumoPorcionadoNome: insumoPorcionado?.nome || input.insumoPorcionadoNome || "",
      quantidadeBaixada: quantidadeBaixa,
      unidade: insumo.unidadeMedida,
      formatoPorcao: input.formatoPorcao || "porcao",
      quantidadePorPorcao: input.quantidadePorPorcao || (input.porcoes > 0 ? quantidadeBaixa / input.porcoes : 0),
      unidadePorcao: input.unidadePorcao || insumo.unidadeMedida,
      porcoesGeradas: input.porcoes,
      porcoesDisponiveis: input.porcoes,
      area: input.area || "producao",
      custoUnitario: custoUnitarioUsoBruto,
      custoTotal,
      custoPorPorcao,
      responsavel: input.responsavel,
      observacao: input.observacao || "Saida do estoque para producao registrada via WhatsApp",
      status: "disponivel",
    };

    const id = await criarDocumento(getPorcoesCollectionPath(input.empresaId), producao);

    await criarDocumento(getHistoricoEstoqueCollectionPath(input.empresaId), {
      data: new Date(),
      tipo: "saida_producao",
      tipoMovimentacao: "producao_saida",
      insumoId: insumo.id,
      insumoNome: insumo.nome,
      quantidade: -quantidadeBaixa,
      custoUnitario: custoUnitarioUsoBruto,
      custoTotal,
      observacao: `${input.porcoes} porcoes geradas para ${producao.area}`,
      responsavel: input.responsavel,
      usuarioId: input.responsavel,
      empresaId: input.empresaId || insumo.empresaId,
      lojaId: input.lojaId || insumo.lojaId,
    });

    if (insumoPorcionado?.id) {
      await criarDocumento(getHistoricoEstoqueCollectionPath(input.empresaId), {
        data: new Date(),
        tipo: "entrada_producao",
        tipoMovimentacao: "producao_entrada",
        insumoId: insumoPorcionado.id,
        insumoNome: insumoPorcionado.nome,
        quantidade: input.porcoes,
        custoUnitario: custoPorPorcao,
        custoTotal,
        observacao: `Entrada de porcoes geradas a partir de ${insumo.nome}`,
        responsavel: input.responsavel,
        usuarioId: input.responsavel,
        empresaId: input.empresaId || insumo.empresaId,
        lojaId: input.lojaId || insumo.lojaId,
      });
    }

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
    const porcoes = await obterTodos<ProducaoPorcao>(getPorcoesCollectionPath(context?.empresaId));
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

export async function getProducaoPorcao(id: string, context?: TenantContext): Promise<ProducaoPorcao | null> {
  try {
    return obterDocumento<ProducaoPorcao>(getPorcoesCollectionPath(context?.empresaId), id);
  } catch (error) {
    console.error("Erro ao buscar producao de porcoes", error);
    return null;
  }
}

export async function estornarProducaoPorcao(id: string, context: Required<TenantContext> & { responsavel: string }): Promise<void> {
  try {
    const porcao = await obterDocumento<ProducaoPorcao>(getPorcoesCollectionPath(context.empresaId), id);
    if (!porcao) throw new Error("Porcao nao encontrada.");
    if (porcao.status === "estornado") throw new Error("Esta producao ja foi estornada.");
    if (porcao.lojaId && porcao.lojaId !== context.lojaId) throw new Error("Esta porcao pertence a outra loja.");

    const brutoId = porcao.insumoBrutoId || porcao.insumoId;
    const bruto = await obterDocumento<Insumo>(getInsumosCollectionPath(context.empresaId), brutoId);
    if (!bruto?.id) throw new Error("Insumo bruto nao encontrado para estorno.");

    const saldoBruto = Number(bruto.estoqueAtual ?? bruto.quantidadeAtual) || 0;
    const novoSaldoBruto = saldoBruto + Number(porcao.quantidadeBaixada || 0);
    await atualizarDocumento<Insumo>(getInsumosCollectionPath(context.empresaId), bruto.id, normalizarInsumoFinanceiro({
      ...bruto,
      estoqueAtual: novoSaldoBruto,
      quantidadeAtual: novoSaldoBruto,
    }));

    if (porcao.insumoPorcionadoId) {
      const porcionado = await obterDocumento<Insumo>(getInsumosCollectionPath(context.empresaId), porcao.insumoPorcionadoId);
      if (porcionado?.id) {
        const saldoPorcionado = Number(porcionado.estoqueAtual ?? porcionado.quantidadeAtual) || 0;
        const novoSaldoPorcionado = Math.max(0, saldoPorcionado - Number(porcao.porcoesGeradas || 0));
        await atualizarDocumento<Insumo>(getInsumosCollectionPath(context.empresaId), porcionado.id, normalizarInsumoFinanceiro({
          ...porcionado,
          estoqueAtual: novoSaldoPorcionado,
          quantidadeAtual: novoSaldoPorcionado,
        }));
      }
    }

    await criarDocumento(getHistoricoEstoqueCollectionPath(context.empresaId), {
      data: new Date(),
      empresaId: context.empresaId,
      lojaId: context.lojaId,
      insumoId: bruto.id,
      insumoNome: bruto.nome,
      quantidade: Number(porcao.quantidadeBaixada || 0),
      custoUnitario: porcao.custoUnitario,
      custoTotal: porcao.custoTotal,
      observacao: `Estorno da producao ${id}`,
      responsavel: context.responsavel,
      tipo: "estorno_producao",
      tipoMovimentacao: "producao_estorno",
      usuarioId: context.responsavel,
    });

    await atualizarDocumento<ProducaoPorcao>(getPorcoesCollectionPath(context.empresaId), id, {
      estornadoEm: new Date(),
      porcoesDisponiveis: 0,
      status: "estornado",
    });
  } catch (error) {
    console.error("Erro ao estornar porcao de producao", error);
    throw error;
  }
}

export async function atualizarProducaoPorcao(id: string, dados: AtualizarPorcaoInput): Promise<void> {
  try {
    const porcaoAtual = await obterDocumento<ProducaoPorcao>(getPorcoesCollectionPath(dados.empresaId), id);
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

    await atualizarDocumento<ProducaoPorcao>(getPorcoesCollectionPath(dados.empresaId), id, {
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
    const porcaoAtual = await obterDocumento<ProducaoPorcao>(getPorcoesCollectionPath(context?.empresaId), id);
    if (!porcaoAtual) throw new Error("Porcao nao encontrada.");
    if (context?.empresaId && porcaoAtual.empresaId && porcaoAtual.empresaId !== context.empresaId) {
      throw new Error("Esta porcao nao pertence a empresa atual.");
    }
    if (context?.lojaId && porcaoAtual.lojaId && porcaoAtual.lojaId !== context.lojaId) {
      throw new Error("Esta porcao nao pertence a loja atual.");
    }
    await deletarDocumento(getPorcoesCollectionPath(context?.empresaId), id);
  } catch (error) {
    console.error("Erro ao excluir porcao de producao", error);
    throw error;
  }
}
