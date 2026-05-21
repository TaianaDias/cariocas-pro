import { doc, getDoc } from "firebase/firestore";
import { NextRequest, NextResponse } from "next/server";

import { db } from "../../../../lib/firebase";
import { calcularAlertaReposicao, calcularConsumoDiario, calcularDiasCobertura, calcularQtdSugerida, buscarMelhorFornecedor, montarLinkWhatsApp } from "../../../../services/reposicao.service";
import type { Insumo } from "../../../../types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const insumoId = searchParams.get("insumoId");

  if (!insumoId) {
    return NextResponse.json({ error: "insumoId e obrigatorio" }, { status: 400 });
  }

  try {
    const docSnap = await getDoc(doc(db, "insumos", insumoId));
    if (!docSnap.exists()) {
      return NextResponse.json({ error: "Insumo nao encontrado" }, { status: 404 });
    }

    const insumo = { id: docSnap.id, ...docSnap.data() } as Insumo;
    const consumoDiario = await calcularConsumoDiario(insumoId);
    const qtdSugerida = calcularQtdSugerida(insumo, consumoDiario);
    const diasCobertura = calcularDiasCobertura(insumo.quantidadeAtual, consumoDiario);
    const melhorFornecedor = buscarMelhorFornecedor(insumo);
    const linkWhatsApp = melhorFornecedor?.telefoneFornecedor
      ? montarLinkWhatsApp(melhorFornecedor.telefoneFornecedor, insumo.nome, qtdSugerida, insumo.unidadeCompra)
      : null;
    const alerta = await calcularAlertaReposicao(insumo);

    return NextResponse.json({
      alerta,
      consumoDiario,
      diasCobertura,
      estoqueAtual: insumo.quantidadeAtual,
      estoqueMinimo: insumo.estoqueMinimo,
      insumoId,
      insumoNome: insumo.nome,
      linkWhatsApp,
      melhorFornecedor,
      qtdSugerida,
    });
  } catch (error) {
    console.error("Erro ao calcular reposicao:", error);
    return NextResponse.json({ error: "Erro ao calcular reposicao" }, { status: 500 });
  }
}
