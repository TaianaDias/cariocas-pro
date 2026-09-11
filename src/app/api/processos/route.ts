import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { isAdministrativeRole } from "../../../lib/access-control";
import { authorizeAppRequest, getAdminApp } from "../../../lib/server-auth";

const SETORES = new Set([
  "cozinha-producao",
  "montagem",
  "salao-delivery",
  "salao-reposicao",
]);

const TIPOS = new Set(["processo", "pop", "checklist"]);
const STATUS = new Set(["rascunho", "ativo", "arquivado"]);
const COMPROVACOES = new Set(["nenhuma", "confirmacao", "texto", "foto"]);

type EtapaInput = {
  id?: unknown;
  titulo?: unknown;
  descricao?: unknown;
  obrigatoria?: unknown;
  comprovacao?: unknown;
};

type ProcessoInput = {
  id?: unknown;
  setor?: unknown;
  nome?: unknown;
  descricao?: unknown;
  tipo?: unknown;
  frequencia?: unknown;
  responsavel?: unknown;
  status?: unknown;
  etapas?: unknown;
};

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeEtapas(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 100).map((item, index) => {
    const etapa = (item || {}) as EtapaInput;
    const comprovacao = text(etapa.comprovacao, 30).toLowerCase();

    return {
      id: text(etapa.id, 120) || `etapa-${index + 1}`,
      titulo: text(etapa.titulo, 180),
      descricao: text(etapa.descricao, 1500),
      obrigatoria: etapa.obrigatoria !== false,
      comprovacao: COMPROVACOES.has(comprovacao) ? comprovacao : "confirmacao",
      ordem: index,
    };
  });
}

function normalizePayload(body: ProcessoInput, fallbackSetor?: string) {
  const setor = text(body.setor, 80) || fallbackSetor || "";
  const tipo = text(body.tipo, 30).toLowerCase();
  const status = text(body.status, 30).toLowerCase();

  return {
    setor,
    nome: text(body.nome, 180),
    descricao: text(body.descricao, 3000),
    tipo: TIPOS.has(tipo) ? tipo : "processo",
    frequencia: text(body.frequencia, 180),
    responsavel: text(body.responsavel, 180),
    status: STATUS.has(status) ? status : "rascunho",
    etapas: normalizeEtapas(body.etapas),
  };
}

async function audit(
  db: Firestore,
  empresaId: string,
  dados: Record<string, unknown>,
) {
  await db
    .collection("empresas")
    .doc(empresaId)
    .collection("processosAuditoria")
    .add({
      ...dados,
      criadoEm: FieldValue.serverTimestamp(),
    });
}

async function getContext(request: NextRequest) {
  const authorization = await authorizeAppRequest(request, "/rotinas");
  if (authorization.status !== 200) {
    return { error: NextResponse.json({ error: "Acesso não autorizado." }, { status: authorization.status }) };
  }

  const app = getAdminApp();
  if (!app) {
    return { error: NextResponse.json({ error: "Firebase Admin não configurado." }, { status: 503 }) };
  }

  return {
    authorization,
    db: getFirestore(app),
  };
}

export async function GET(request: NextRequest) {
  const context = await getContext(request);
  if (context.error) return context.error;

  const { authorization, db } = context;
  const setor = text(request.nextUrl.searchParams.get("setor"), 80);
  const administrative = isAdministrativeRole(authorization.role);

  if (setor && !SETORES.has(setor)) {
    return NextResponse.json({ error: "Setor inválido." }, { status: 400 });
  }

  const snapshot = await db
    .collection("empresas")
    .doc(authorization.empresaId)
    .collection("processos")
    .get();

  const processos = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((processo) => {
      const item = processo as { lojaId?: string; setor?: string; status?: string };
      return item.lojaId === authorization.lojaId
        && (!setor || item.setor === setor)
        && (administrative || item.status === "ativo");
    })
    .sort((a, b) => {
      const itemA = a as { ordem?: number; nome?: string };
      const itemB = b as { ordem?: number; nome?: string };
      const ordem = (itemA.ordem ?? 9999) - (itemB.ordem ?? 9999);
      return ordem || String(itemA.nome || "").localeCompare(String(itemB.nome || ""), "pt-BR");
    });

  return NextResponse.json({ processos });
}

export async function POST(request: NextRequest) {
  const context = await getContext(request);
  if (context.error) return context.error;

  const { authorization, db } = context;
  if (!isAdministrativeRole(authorization.role)) {
    return NextResponse.json({ error: "Somente a gestão pode criar processos." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as ProcessoInput;
  const payload = normalizePayload(body);

  if (!SETORES.has(payload.setor)) {
    return NextResponse.json({ error: "Selecione um setor válido." }, { status: 400 });
  }

  if (!payload.nome) {
    return NextResponse.json({ error: "Informe o nome do processo." }, { status: 400 });
  }

  const collection = db.collection("empresas").doc(authorization.empresaId).collection("processos");
  const ref = collection.doc();
  const ordem = (await collection.get()).docs.filter((doc) => doc.data().lojaId === authorization.lojaId).length;

  const documento = {
    ...payload,
    empresaId: authorization.empresaId,
    lojaId: authorization.lojaId,
    ordem,
    criadoPor: authorization.profile.uid,
    criadoPorNome: authorization.profile.nome || authorization.profile.email || "Gestão",
    criadoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
    atualizadoPor: authorization.profile.uid,
  };

  await ref.set(documento);
  await audit(db, authorization.empresaId, {
    processoId: ref.id,
    acao: "criado",
    lojaId: authorization.lojaId,
    setor: payload.setor,
    usuarioId: authorization.profile.uid,
    usuarioNome: authorization.profile.nome || authorization.profile.email || "Gestão",
    depois: documento,
  });

  return NextResponse.json({ id: ref.id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const context = await getContext(request);
  if (context.error) return context.error;

  const { authorization, db } = context;
  if (!isAdministrativeRole(authorization.role)) {
    return NextResponse.json({ error: "Somente a gestão pode editar processos." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as ProcessoInput;
  const id = text(body.id, 180);
  if (!id) return NextResponse.json({ error: "Processo não informado." }, { status: 400 });

  const ref = db.collection("empresas").doc(authorization.empresaId).collection("processos").doc(id);
  const atual = await ref.get();
  if (!atual.exists) return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });

  const anterior = atual.data() || {};
  if (anterior.lojaId !== authorization.lojaId) {
    return NextResponse.json({ error: "Processo pertence a outra loja." }, { status: 403 });
  }

  const payload = normalizePayload(body, String(anterior.setor || ""));
  if (!SETORES.has(payload.setor)) {
    return NextResponse.json({ error: "Setor inválido." }, { status: 400 });
  }
  if (!payload.nome) {
    return NextResponse.json({ error: "Informe o nome do processo." }, { status: 400 });
  }

  const atualizacao = {
    ...payload,
    atualizadoEm: FieldValue.serverTimestamp(),
    atualizadoPor: authorization.profile.uid,
  };

  await ref.update(atualizacao);
  await audit(db, authorization.empresaId, {
    processoId: id,
    acao: payload.status === "arquivado" && anterior.status !== "arquivado" ? "arquivado" : "editado",
    lojaId: authorization.lojaId,
    setor: payload.setor,
    usuarioId: authorization.profile.uid,
    usuarioNome: authorization.profile.nome || authorization.profile.email || "Gestão",
    antes: anterior,
    depois: atualizacao,
  });

  return NextResponse.json({ ok: true });
}
