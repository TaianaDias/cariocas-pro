import { NextRequest, NextResponse } from "next/server";

import { authorizeAppRequest, getAdminApp } from "../../../lib/server-auth";
import {
  aprovarSolicitacaoCompra,
  cancelarSolicitacaoCompra,
  criarSolicitacaoCompra,
  enviarSolicitacaoCompraAgora,
  listarCentralCompras,
  registrarRecebimentoSolicitacao,
  type CompraActor,
  type CompraDecisionInput,
  type CompraItemInput,
  type CompraRecebimentoInput,
} from "../../../server/compras-flow";
import { getFirestore } from "firebase-admin/firestore";

type Body = {
  acao?: unknown;
  id?: unknown;
  itens?: unknown;
  observacoes?: unknown;
  prioridade?: unknown;
  recebimentos?: unknown;
  setor?: unknown;
  decisoes?: unknown;
};

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function errorResponse(error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status });
}

async function context(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/compras");
  if (access.status !== 200) {
    return { error: NextResponse.json({ error: "Acesso não autorizado." }, { status: access.status }) };
  }

  const app = getAdminApp();
  if (!app) {
    return { error: NextResponse.json({ error: "Firebase Admin não configurado." }, { status: 503 }) };
  }

  const actor: CompraActor = {
    uid: access.profile.uid,
    nome: access.profile.nome || access.profile.email || "Equipe",
    role: access.role,
    permissoes: access.profile.permissoes || [],
  };

  return {
    actor,
    db: getFirestore(app),
    tenant: { empresaId: access.empresaId, lojaId: access.lojaId },
  };
}

function parseItens(value: unknown): CompraItemInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 100)
    .map((item) => ({
      insumoId: text((item as Record<string, unknown>)?.insumoId, 180),
      quantidade: number((item as Record<string, unknown>)?.quantidade),
    }))
    .filter((item) => item.insumoId && item.quantidade > 0);
}

function parseDecisoes(value: unknown): CompraDecisionInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 100)
    .map((item) => {
      const data = item as Record<string, unknown>;
      return {
        aprovar: data.aprovar !== false,
        insumoId: text(data.insumoId, 180),
        motivo: text(data.motivo, 500),
        quantidade: number(data.quantidade),
      };
    })
    .filter((item) => item.insumoId);
}

function parseRecebimentos(value: unknown): CompraRecebimentoInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 100)
    .map((item) => ({
      insumoId: text((item as Record<string, unknown>)?.insumoId, 180),
      quantidade: number((item as Record<string, unknown>)?.quantidade),
    }))
    .filter((item) => item.insumoId && item.quantidade > 0);
}

export async function GET(request: NextRequest) {
  const ctx = await context(request);
  if (ctx.error) return ctx.error;

  try {
    const data = await listarCentralCompras(ctx.db, ctx.tenant, ctx.actor);
    return NextResponse.json(data);
  } catch (error) {
    return errorResponse(error, "Não foi possível carregar a Central de Compras.", 500);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await context(request);
  if (ctx.error) return ctx.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const itens = parseItens(body.itens);
    const resultado = await criarSolicitacaoCompra(ctx.db, ctx.tenant, ctx.actor, {
      itens,
      observacoes: text(body.observacoes, 2000),
      origemSolicitacao: "sistema",
      prioridade: text(body.prioridade, 30),
      setor: text(body.setor, 120) || "Operação",
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Não foi possível criar a solicitação.");
  }
}

export async function PATCH(request: NextRequest) {
  const ctx = await context(request);
  if (ctx.error) return ctx.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const id = text(body.id, 180);
    const acao = text(body.acao, 50).toLowerCase();
    if (!id) return NextResponse.json({ error: "Solicitação não informada." }, { status: 400 });

    if (acao === "aprovar") {
      const resultado = await aprovarSolicitacaoCompra(ctx.db, ctx.tenant, ctx.actor, id, parseDecisoes(body.decisoes));
      return NextResponse.json(resultado);
    }

    if (acao === "enviar") {
      const resultado = await enviarSolicitacaoCompraAgora(ctx.db, ctx.tenant, ctx.actor, id);
      return NextResponse.json(resultado);
    }

    if (acao === "receber") {
      const recebimentos = parseRecebimentos(body.recebimentos);
      const resultado = await registrarRecebimentoSolicitacao(ctx.db, ctx.tenant, ctx.actor, id, recebimentos.length ? recebimentos : undefined);
      return NextResponse.json(resultado);
    }

    if (acao === "cancelar") {
      const resultado = await cancelarSolicitacaoCompra(ctx.db, ctx.tenant, ctx.actor, id);
      return NextResponse.json(resultado);
    }

    return NextResponse.json({ error: "Ação não reconhecida." }, { status: 400 });
  } catch (error) {
    return errorResponse(error, "Não foi possível atualizar a solicitação.", 403);
  }
}
