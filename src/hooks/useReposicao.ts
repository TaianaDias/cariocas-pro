"use client";

import { useCallback, useState } from "react";

import {
  buscarMelhorFornecedor,
  calcularConsumoDiario,
  calcularDiasCobertura,
  calcularQtdSugerida,
  montarLinkWhatsApp,
} from "../services/reposicao.service";
import type { Insumo } from "../types";

type CalculoReposicao = {
  consumoDiario: number;
  custoEstimado: number;
  diasCobertura: number;
  linkWhatsApp: string | null;
  loading: boolean;
  melhorFornecedor: unknown;
  qtdSugerida: number;
};

export function useReposicao() {
  const [calculos, setCalculos] = useState<Record<string, CalculoReposicao>>({});

  const calcular = useCallback(async (insumo: Insumo) => {
    if (!insumo.id) return;

    setCalculos((current) => ({
      ...current,
      [insumo.id!]: { ...current[insumo.id!], loading: true },
    }));

    const consumoDiario = await calcularConsumoDiario(insumo.id);
    const qtdSugerida = calcularQtdSugerida(insumo, consumoDiario);
    const diasCobertura = calcularDiasCobertura(insumo.quantidadeAtual, consumoDiario);
    const melhorFornecedor = buscarMelhorFornecedor(insumo);
    const fornecedorTelefone = melhorFornecedor?.telefoneFornecedor;
    const custoFornecedor = melhorFornecedor?.custoUnitario || melhorFornecedor?.custo || insumo.custoCompra;
    const linkWhatsApp = fornecedorTelefone
      ? montarLinkWhatsApp(fornecedorTelefone, insumo.nome, qtdSugerida, insumo.unidadeCompra)
      : null;

    setCalculos((current) => ({
      ...current,
      [insumo.id!]: {
        consumoDiario,
        custoEstimado: Math.round(qtdSugerida * custoFornecedor * 100) / 100,
        diasCobertura,
        linkWhatsApp,
        loading: false,
        melhorFornecedor,
        qtdSugerida,
      },
    }));
  }, []);

  return { calcular, calculos };
}
