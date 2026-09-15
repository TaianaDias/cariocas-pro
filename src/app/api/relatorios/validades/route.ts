import { FieldValue, getFirestore, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { authorizeAppRequest, getAdminApp } from "../../../../lib/server-auth";

const STATUS = new Set(["ativo", "consumido", "descartado"]);

type ValidadeInput = {
  id?: unknown;
  insumoId?: unknown;
  lote?: unknown;
  dataValidade?: unknown;
  quantidade?: unknown;
  observacao?: unknown;
  status?: unknown;
};

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function validadeCollection(db: Firestore, empresaId: string) {
  return db.collection("empresas").doc(empresaId).collection("validades");
}

function insumoCollection(db: Firestore, empresaId: string) {
  return db.collection("empresas").doc(empresaId).collection("insumos");
}

async function getContext(request: NextRequest) {
  const authorization = await authorizeAppRequest(request, "/relatorios/validades");
  if (authorization.status !== 200) {
    return { error: NextResponse.json({ error: "Acesso não autorizado." }, { status: authorization.status }) };
  }

  const app = getAdminApp();
  if (!app) {
    return { error: NextResponse.json({ error: "Firebase Admin não configurado." }, { status: 503 }) };
  }

  return { authorization, db: getFirestore(app) };
}

async function getInsumoSeguro(db: Firestore, empresaId: string, lojaId: string, insumoId: string) {
  const tenantDoc = await insumoCollection(db, empresaId).doc(insumoId).get();
  if (tenantDoc.exists) {
    const data = tenantDoc.data() || {};
    if (data.lojaId && data.lojaId !== lojaId) return null;
    return { id: tenantDoc.id, data };
  }

  const legacyDoc = await db.collection("insumos").doc(insumoId).get();
  if (!legacyDoc.exists) return null;
  const data = legacyDoc.data() || {};
  if (data.empresaId !== empresaId || (data.lojaId && data.lojaId !== lojaId)) return null;
  return { id: legacyDoc.id, data };
}

function sanitizeValidade(id: string, data: DocumentData) {
  const statusRaw = text(data.status, 30).toLowerCase();
  return {
    id,
    insumoId: text(data.insumoId, 180),
    insumoNome: text(data.insumoNome, 220),
    lote: text(data.lote, 160),
    dataValidade: toIso(data.dataValidade),
    quantidade: number(data.quantidade),
    unidade: text(data.unidade, 60),
    observacao: text(data.observacao, 1500),
    status: STATUS.has(statusRaw) ? statusRaw : "ativo",
    criadoPorNome: text(data.criadoPorNome, 220) || "Equipe",
    criadoEm: toIso(data.criadoEm),
    atualizadoEm: toIso(data.atualizadoEm),
  };
}

export async function GET(request: NextRequest) {
  const context = await getContext(request);
  if (context.error) return context.error;

  const { authorization, db } = context;
  const [validadesSnap, insumosSnap] = await Promise.all([
    validadeCollection(db, authorization.empresaId).get(),
    insumoCollection(db, authorization.empresaId).get(),
  ]);

  const validades = validadesSnap.docs
    .filter((doc) => doc.data().lojaId === authorization.lojaId)
    .map((doc) => sanitizeValidade(doc.id, doc.data()))
    .sort((a, b) => String(a.dataValidade || "9999").localeCompare(String(b.dataValidade || "9999")));

  let insumos = insumosSnap.docs
    .filter((doc) => {
      const data = doc.data();
      return !data.lojaId || data.lojaId === authorization.lojaId;
    })
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        nome: text(data.nome, 220),
        unidade: text(data.unidadeMedida || data.unidadeUso || data.unidadeCompra || "un", 60),
        loteInterno: text(data.loteInterno, 160),
        quantidadeAtual: number(data.quantidadeAtual ?? data.estoqueAtual),
        validadeOriginal: number(data.validadeOriginal),
        validadeAposAberto: number(data.validadeAposAberto),
        validadeAposProducao: number(data.validadeAposProducao),
      };
    });

  if (insumos.length === 0) {
    const legacySnap = await db.collection("insumos").where("empresaId", "==", authorization.empresaId).get();
    insumos = legacySnap.docs
      .filter((doc) => {
        const data = doc.data();
        return !data.lojaId || data.lojaId === authorization.lojaId;
      })
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          nome: text(data.nome, 220),
          unidade: text(data.unidadeMedida || data.unidadeUso || data.unidadeCompra || "un", 60),
          loteInterno: text(data.loteInterno, 160),
          quantidadeAtual: number(data.quantidadeAtual ?? data.estoqueAtual),
          validadeOriginal: number(data.validadeOriginal),
          validadeAposAberto: number(data.validadeAposAberto),
          validadeAposProducao: number(data.validadeAposProducao),
        };
      });
  }

  insumos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return NextResponse.json({ validades, insumos });
}

export async function POST(request: NextRequest) {
  const context = await getContext(request);
  if (context.error) return context.error;

  const { authorization, db } = context;
  const body = (await request.json().catch(() => ({}))) as ValidadeInput;
  const insumoId = text(body.insumoId, 180);
  const lote = text(body.lote, 160);
  const dataText = text(body.dataValidade, 20);
  const quantidade = number(body.quantidade);
  const observacao = text(body.observacao, 1500);

  if (!insumoId) return NextResponse.json({ error: "Selecione um insumo." }, { status: 400 });
  if (!dataText) return NextResponse.json({ error: "Informe a data de validade." }, { status: 400 });
  if (quantidade < 0) return NextResponse.json({ error: "A quantidade não pode ser negativa." }, { status: 400 });

  const dataValidade = new Date(`${dataText}T12:00:00.000Z`);
  if (Number.isNaN(dataValidade.getTime())) {
    return NextResponse.json({ error: "Data de validade inválida." }, { status: 400 });
  }

  const insumo = await getInsumoSeguro(db, authorization.empresaId, authorization.lojaId, insumoId);
  if (!insumo) {
    return NextResponse.json({ error: "Insumo não encontrado nesta loja." }, { status: 404 });
  }

  const usuarioNome = authorization.profile.nome || authorization.profile.email || "Equipe";
  const ref = validadeCollection(db, authorization.empresaId).doc();
  await ref.set({
    insumoId,
    insumoNome: text(insumo.data.nome, 220) || "Insumo",
    lote: lote || text(insumo.data.loteInterno, 160),
    dataValidade,
    quantidade,
    unidade: text(insumo.data.unidadeMedida || insumo.data.unidadeUso || insumo.data.unidadeCompra || "un", 60),
    observacao,
    status: "ativo",
    empresaId: authorization.empresaId,
    lojaId: authorization.lojaId,
    criadoPor: authorization.profile.uid,
    criadoPorNome: usuarioNome,
    criadoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ id: ref.id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const context = await getContext(request);
  if (context.error) return context.error;

  const { authorization, db } = context;
  const body = (await request.json().catch(() => ({}))) as ValidadeInput;
  const id = text(body.id, 180);
  const status = text(body.status, 30).toLowerCase();

  if (!id) return NextResponse.json({ error: "Registro não informado." }, { status: 400 });
  if (status !== "consumido" && status !== "descartado") {
    return NextResponse.json({ error: "Status inválido para encerramento." }, { status: 400 });
  }

  const ref = validadeCollection(db, authorization.empresaId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Registro de validade não encontrado." }, { status: 404 });
  const atual = snap.data() || {};
  if (atual.lojaId !== authorization.lojaId) {
    return NextResponse.json({ error: "Registro pertence a outra loja." }, { status: 403 });
  }
  if (atual.status !== "ativo") {
    return NextResponse.json({ error: "Esta validade já foi encerrada." }, { status: 409 });
  }

  await ref.update({
    status,
    encerradoPor: authorization.profile.uid,
    encerradoPorNome: authorization.profile.nome || authorization.profile.email || "Equipe",
    encerradoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true, status });
}
