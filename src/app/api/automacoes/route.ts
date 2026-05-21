import { NextRequest, NextResponse } from "next/server";

import { dispararAutomacao } from "../../../services/automacoes-whatsapp.service";

const CONFIG_PADRAO = {
  notificarEntrada: true,
  notificarEstoqueBaixo: true,
  notificarSaida: true,
  notificarVencimento: true,
  numeroAdmin: "5521988531687",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dados, insumoId, insumoNome, quantidade, responsavel, tipo } = body;

    const resultado = await dispararAutomacao(
      {
        dados: { ...CONFIG_PADRAO, ...dados },
        insumoId,
        insumoNome,
        quantidade,
        responsavel,
        tipo,
      },
      CONFIG_PADRAO.numeroAdmin,
    );

    return NextResponse.json({ success: true, resultado });
  } catch (error) {
    console.error("Erro automacao:", error);
    return NextResponse.json({ error: "Erro ao processar automacao" }, { status: 500 });
  }
}
