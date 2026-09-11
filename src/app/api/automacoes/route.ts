import { NextRequest, NextResponse } from "next/server";

import { isAdministrativeRole } from "../../../lib/access-control";
import { authorizeAppRequest } from "../../../lib/server-auth";
import { dispararAutomacao } from "../../../services/automacoes-whatsapp.service";

const TIPOS_PERMITIDOS = new Set(["entrada", "saida", "estoque_baixo", "vencendo", "vencido", "sugestao_compra"]);

export async function POST(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/estoque");
  if (access.status !== 200) {
    return NextResponse.json(
      { error: access.status === 401 ? "Sessão inválida." : "Acesso não autorizado." },
      { status: access.status },
    );
  }

  if (!isAdministrativeRole(access.role)) {
    return NextResponse.json({ error: "Disparo manual de automações restrito à gestão." }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      dados?: Record<string, unknown>;
      insumoId?: string;
      insumoNome?: string;
      quantidade?: number;
      tipo?: string;
    };
    const tipo = String(body.tipo || "");

    if (!TIPOS_PERMITIDOS.has(tipo)) {
      return NextResponse.json({ error: "Tipo de automação inválido." }, { status: 400 });
    }

    const numeroAdmin = process.env.WHATSAPP_ADMIN_NUMBER?.replace(/\D/g, "") || "";
    if (!numeroAdmin) {
      return NextResponse.json({ error: "Número administrativo não configurado." }, { status: 503 });
    }

    const dados = { ...(body.dados || {}) };
    delete dados.whatsappNumber;

    const resultado = await dispararAutomacao(
      {
        dados,
        empresaId: access.empresaId,
        insumoId: body.insumoId,
        insumoNome: body.insumoNome,
        lojaId: access.lojaId,
        quantidade: Number(body.quantidade) || 0,
        responsavel: access.profile.uid,
        tipo,
      },
      numeroAdmin,
    );

    return NextResponse.json({ success: true, resultado });
  } catch (error) {
    console.error("Erro automacao:", error);
    return NextResponse.json({ error: "Erro ao processar automacao" }, { status: 500 });
  }
}
