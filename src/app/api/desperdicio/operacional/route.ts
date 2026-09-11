import { FieldValue, getFirestore, type DocumentData, type DocumentReference } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";

import { authorizeAppRequest, getAdminApp } from "../../../../lib/server-auth";

function authError(status: number) {
  return NextResponse.json(
    { error: status === 401 ? "Sessão inválida ou expirada." : "Acesso não autorizado ao desperdício." },
    { status },
  );
}

function toIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function safeWaste(id: string, data: DocumentData) {
  return {
    id,
    categoria: String(data.categoria || "outro"),
    data: toIso(data.data || data.criadoEm),
    insumoId: String(data.insumoId || ""),
    insumoNome: String(data.insumoNome || ""),
    motivo: String(data.motivo || ""),
    quantidade: Number(data.quantidade) || 0,
    responsavel: String(data.responsavel || ""),
    unidade: String(data.unidade || "un"),
  };
}

async function resolveInsumoRef(empresaId: string, lojaId: string, insumoId: string) {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin não configurado.");
  const firestore = getFirestore(app);

  const nested = firestore.collection("empresas").doc(empresaId).collection("insumos").doc(insumoId);
  const nestedSnapshot = await nested.get();
  if (nestedSnapshot.exists) {
    const data = nestedSnapshot.data() || {};
    if (!data.lojaId || data.lojaId === lojaId) return nested;
  }

  const legacy = firestore.collection("insumos").doc(insumoId);
  const legacySnapshot = await legacy.get();
  if (!legacySnapshot.exists) return null;
  const data = legacySnapshot.data() || {};
  if (data.empresaId !== empresaId || data.lojaId !== lojaId) return null;
  return legacy;
}

export async function GET(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/desperdicio");
  if (access.status !== 200) return authError(access.status);

  try {
    const app = getAdminApp();
    if (!app) throw new Error("Firebase Admin não configurado.");
    const firestore = getFirestore(app);

    const nested = await firestore
      .collection("empresas")
      .doc(access.empresaId)
      .collection("desperdicios")
      .where("lojaId", "==", access.lojaId)
      .get();

    const docs = nested.empty
      ? (await firestore
          .collection("desperdicio")
          .where("empresaId", "==", access.empresaId)
          .where("lojaId", "==", access.lojaId)
          .get()).docs
      : nested.docs;

    const items = docs
      .map((doc) => safeWaste(doc.id, doc.data()))
      .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")))
      .slice(0, 100);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Erro ao carregar desperdícios operacionais:", error);
    return NextResponse.json({ error: "Não foi possível carregar os desperdícios." }, { status: 500 });
  }
}

type WasteBody = {
  categoria?: string;
  insumoId?: string;
  motivo?: string;
  quantidade?: number;
};

export async function POST(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/desperdicio");
  if (access.status !== 200) return authError(access.status);

  const body = (await request.json().catch(() => ({}))) as WasteBody;
  const insumoId = body.insumoId?.trim();
  const quantidade = Number(body.quantidade);
  const motivo = body.motivo?.trim();

  if (!insumoId || !motivo || !Number.isFinite(quantidade) || quantidade <= 0) {
    return NextResponse.json({ error: "Informe insumo, quantidade e motivo." }, { status: 400 });
  }

  try {
    const app = getAdminApp();
    if (!app) throw new Error("Firebase Admin não configurado.");
    const firestore = getFirestore(app);
    const insumoRef = await resolveInsumoRef(access.empresaId, access.lojaId, insumoId);

    if (!insumoRef) {
      return NextResponse.json({ error: "Insumo não encontrado nesta loja." }, { status: 404 });
    }

    const desperdicioRef = firestore.collection("empresas").doc(access.empresaId).collection("desperdicios").doc();
    const historicoRef = firestore.collection("empresas").doc(access.empresaId).collection("historicoEstoque").doc();

    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(insumoRef as DocumentReference<DocumentData>);
      if (!snapshot.exists) throw new Error("Insumo não encontrado.");
      const data = snapshot.data() || {};
      if (data.lojaId && data.lojaId !== access.lojaId) throw new Error("Loja inválida.");

      const estoqueAtual = Number(data.quantidadeAtual ?? data.estoqueAtual) || 0;
      if (estoqueAtual < quantidade) throw new Error("Estoque insuficiente para registrar o desperdício.");

      const novoEstoque = estoqueAtual - quantidade;
      const custoUnitario = Number(data.custoUnitarioUso ?? data.custoUnitario ?? data.custoCompra) || 0;
      const custoEstimado = Math.round(quantidade * custoUnitario * 100) / 100;
      const unidade = String(data.unidadeMedida || data.unidadeUso || "un");
      const insumoNome = String(data.nome || "Insumo");

      transaction.update(insumoRef, {
        atualizadoEm: FieldValue.serverTimestamp(),
        estoqueAtual: novoEstoque,
        quantidadeAtual: novoEstoque,
      });

      transaction.set(desperdicioRef, {
        categoria: body.categoria?.trim() || "outro",
        colaboradorId: access.profile.uid,
        criadoEm: FieldValue.serverTimestamp(),
        custoEstimado,
        data: FieldValue.serverTimestamp(),
        empresaId: access.empresaId,
        insumoId,
        insumoNome,
        lojaId: access.lojaId,
        motivo,
        quantidade,
        responsavel: access.profile.uid,
        unidade,
      });

      transaction.set(historicoRef, {
        criadoEm: FieldValue.serverTimestamp(),
        custoTotal: custoEstimado,
        custoUnitario,
        data: FieldValue.serverTimestamp(),
        empresaId: access.empresaId,
        insumoId,
        insumoNome,
        lojaId: access.lojaId,
        motivo,
        observacao: `Desperdício: ${motivo}`,
        quantidade: -quantidade,
        responsavel: access.profile.uid,
        tipo: "desperdicio",
        tipoMovimentacao: "desperdicio",
        unidade,
        usuarioId: access.profile.uid,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar o desperdício.";
    return NextResponse.json({ error: message }, { status: message.includes("insuficiente") ? 409 : 500 });
  }
}
