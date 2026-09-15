import { FieldValue, getFirestore, type DocumentData, type Firestore } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { isAdministrativeRole } from "../../../lib/access-control";
import { authorizeAppRequest, getAdminApp } from "../../../lib/server-auth";

const STATUS = new Set(["solicitado", "aprovado", "comprado", "cancelado"]);
const PRIORIDADES = new Set(["normal", "alta", "urgente"]);

type ItemInput = {
  insumoId?: unknown;
  quantidade?: unknown;
};

type PedidoInput = {
  id?: unknown;
  acao?: unknown;
  setor?: unknown;
  prioridade?: unknown;
  observacoes?: unknown;
  itens?: unknown;
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
    return ((value as { toDate: () => Date }).toDate()).toISOString();
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function pedidoCollection(db: Firestore, empresaId: string) {
  return db.collection("empresas").doc(empresaId).collection("pedidosCompra");
}

function insumoCollection(db: Firestore, empresaId: string) {
  return db.collection("empresas").doc(empresaId).collection("insumos");
}

async function getContext(request: NextRequest) {
  const authorization = await authorizeAppRequest(request, "/pedidos-insumos");
  if (authorization.status !== 200) {
    return { error: NextResponse.json({ error: "Acesso não autorizado." }, { status: authorization.status }) };
  }

  const app = getAdminApp();
  if (!app) {
    return { error: NextResponse.json({ error: "Firebase Admin não configurado." }, { status: 503 }) };
  }

  return { authorization, db: getFirestore(app) };
}

function sanitizePedido(id: string, data: DocumentData) {
  const itens = Array.isArray(data.itens)
    ? data.itens.map((item: DocumentData) => ({
        insumoId: text(item.insumoId, 180),
        insumoNome: text(item.insumoNome, 220),
        quantidade: number(item.quantidade),
        unidade: text(item.unidade, 60),
      }))
    : [];

  return {
    id,
    numero: text(data.numero, 80),
    status: STATUS.has(data.status) ? data.status : "solicitado",
    prioridade: PRIORIDADES.has(data.prioridade) ? data.prioridade : "normal",
    setor: text(data.setor, 120),
    observacoes: text(data.observacoes, 2000),
    itens,
    solicitadoPor: text(data.solicitadoPor, 180),
    solicitadoPorNome: text(data.solicitadoPorNome, 220) || "Equipe",
    criadoEm: toIso(data.criadoEm || data.dataPedido),
    atualizadoEm: toIso(data.atualizadoEm),
    historicoStatus: Array.isArray(data.historicoStatus)
      ? data.historicoStatus.map((item: DocumentData) => ({
          status: text(item.status, 40),
          usuarioNome: text(item.usuarioNome, 220),
          data: toIso(item.data),
        }))
      : [],
  };
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

export async function GET(request: NextRequest) {
  const context = await getContext(request);
  if (context.error) return context.error;

  const { authorization, db } = context;
  const [pedidosSnap, insumosSnap] = await Promise.all([
    pedidoCollection(db, authorization.empresaId).get(),
    insumoCollection(db, authorization.empresaId).get(),
  ]);

  const pedidos = pedidosSnap.docs
    .filter((doc) => {
      const data = doc.data();
      return data.tipoFluxo === "solicitacao_interna" && data.lojaId === authorization.lojaId;
    })
    .map((doc) => sanitizePedido(doc.id, doc.data()))
    .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));

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
        quantidadeAtual: number(data.quantidadeAtual ?? data.estoqueAtual),
        estoqueMinimo: number(data.estoqueMinimo),
        estoqueMaximo: number(data.estoqueMaximo),
        categoriaId: text(data.categoriaId, 120),
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
          quantidadeAtual: number(data.quantidadeAtual ?? data.estoqueAtual),
          estoqueMinimo: number(data.estoqueMinimo),
          estoqueMaximo: number(data.estoqueMaximo),
          categoriaId: text(data.categoriaId, 120),
        };
      });
  }

  insumos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return NextResponse.json({ pedidos, insumos });
}

export async function POST(request: NextRequest) {
  const context = await getContext(request);
  if (context.error) return context.error;

  const { authorization, db } = context;
  const body = (await request.json().catch(() => ({}))) as PedidoInput;
  const setor = text(body.setor, 120);
  const prioridadeRaw = text(body.prioridade, 30).toLowerCase();
  const prioridade = PRIORIDADES.has(prioridadeRaw) ? prioridadeRaw : "normal";
  const observacoes = text(body.observacoes, 2000);
  const itensRaw = Array.isArray(body.itens) ? body.itens.slice(0, 80) as ItemInput[] : [];

  if (!setor) {
    return NextResponse.json({ error: "Informe o setor solicitante." }, { status: 400 });
  }
  if (!itensRaw.length) {
    return NextResponse.json({ error: "Adicione pelo menos um item ao pedido." }, { status: 400 });
  }

  const ids = new Set<string>();
  const itens = [] as { insumoId: string; insumoNome: string; quantidade: number; unidade: string; valorUnitario: number; valorTotal: number }[];

  for (const item of itensRaw) {
    const insumoId = text(item.insumoId, 180);
    const quantidade = number(item.quantidade);
    if (!insumoId || ids.has(insumoId) || quantidade <= 0) continue;

    const insumo = await getInsumoSeguro(db, authorization.empresaId, authorization.lojaId, insumoId);
    if (!insumo) {
      return NextResponse.json({ error: "Um dos insumos informados não pertence a esta loja." }, { status: 400 });
    }

    ids.add(insumoId);
    itens.push({
      insumoId,
      insumoNome: text(insumo.data.nome, 220) || "Insumo",
      quantidade,
      unidade: text(insumo.data.unidadeMedida || insumo.data.unidadeUso || insumo.data.unidadeCompra || "un", 60),
      valorUnitario: 0,
      valorTotal: 0,
    });
  }

  if (!itens.length) {
    return NextResponse.json({ error: "Informe itens válidos com quantidade maior que zero." }, { status: 400 });
  }

  const agora = new Date();
  const numero = `OP-${agora.toISOString().slice(2, 10).replace(/-/g, "")}-${String(agora.getTime()).slice(-5)}`;
  const ref = pedidoCollection(db, authorization.empresaId).doc();
  const usuarioNome = authorization.profile.nome || authorization.profile.email || "Equipe";

  await ref.set({
    tipoFluxo: "solicitacao_interna",
    numero,
    status: "solicitado",
    prioridade,
    setor,
    observacoes,
    itens,
    valorTotal: 0,
    origemCompra: "fornecedor",
    fornecedorId: "",
    fornecedorNome: "",
    empresaId: authorization.empresaId,
    lojaId: authorization.lojaId,
    solicitadoPor: authorization.profile.uid,
    solicitadoPorNome: usuarioNome,
    createdBy: authorization.profile.uid,
    dataPedido: FieldValue.serverTimestamp(),
    criadoEm: FieldValue.serverTimestamp(),
    atualizadoEm: FieldValue.serverTimestamp(),
    historicoStatus: [{ status: "solicitado", usuarioId: authorization.profile.uid, usuarioNome, data: agora }],
  });

  return NextResponse.json({ id: ref.id, numero }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const context = await getContext(request);
  if (context.error) return context.error;

  const { authorization, db } = context;
  const body = (await request.json().catch(() => ({}))) as PedidoInput;
  const id = text(body.id, 180);
  const acao = text(body.acao, 40).toLowerCase();

  if (!id) return NextResponse.json({ error: "Pedido não informado." }, { status: 400 });

  const ref = pedidoCollection(db, authorization.empresaId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const atual = snap.data() || {};
  if (atual.tipoFluxo !== "solicitacao_interna" || atual.lojaId !== authorization.lojaId) {
    return NextResponse.json({ error: "Pedido não pertence a esta loja." }, { status: 403 });
  }

  const administrative = isAdministrativeRole(authorization.role);
  const statusAtual = STATUS.has(atual.status) ? atual.status : "solicitado";
  let proximoStatus = "";

  if (administrative && acao === "aprovar" && statusAtual === "solicitado") proximoStatus = "aprovado";
  if (administrative && acao === "comprado" && statusAtual === "aprovado") proximoStatus = "comprado";
  if (administrative && acao === "cancelar" && (statusAtual === "solicitado" || statusAtual === "aprovado")) proximoStatus = "cancelado";

  const podeCancelarProprio = !administrative
    && acao === "cancelar"
    && statusAtual === "solicitado"
    && atual.solicitadoPor === authorization.profile.uid;
  if (podeCancelarProprio) proximoStatus = "cancelado";

  if (!proximoStatus) {
    return NextResponse.json({ error: "Esta alteração de status não é permitida." }, { status: 403 });
  }

  const agora = new Date();
  const usuarioNome = authorization.profile.nome || authorization.profile.email || "Equipe";
  const historico = Array.isArray(atual.historicoStatus) ? atual.historicoStatus.slice(0, 100) : [];
  historico.push({ status: proximoStatus, usuarioId: authorization.profile.uid, usuarioNome, data: agora });

  const update: Record<string, unknown> = {
    status: proximoStatus,
    atualizadoEm: FieldValue.serverTimestamp(),
    historicoStatus: historico,
  };
  if (proximoStatus === "aprovado") update.aprovadoEm = FieldValue.serverTimestamp();
  if (proximoStatus === "comprado") update.compradoEm = FieldValue.serverTimestamp();
  if (proximoStatus === "cancelado") update.canceladoEm = FieldValue.serverTimestamp();

  await ref.update(update);
  return NextResponse.json({ ok: true, status: proximoStatus });
}
