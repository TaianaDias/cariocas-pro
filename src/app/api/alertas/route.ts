import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";

import { isAdministrativeRole } from "../../../lib/access-control";
import { authorizeAppRequest, getAdminApp } from "../../../lib/server-auth";

function errorResponse(status: number) {
  return NextResponse.json(
    { error: status === 401 ? "Sessão inválida ou expirada." : "Acesso não autorizado aos alertas." },
    { status },
  );
}

async function tenantStockIds(empresaId: string, lojaId: string) {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin não configurado.");

  const firestore = getFirestore(app);
  const nested = await firestore
    .collection("empresas")
    .doc(empresaId)
    .collection("insumos")
    .where("lojaId", "==", lojaId)
    .get();

  if (!nested.empty) {
    return new Set(nested.docs.map((doc) => doc.id));
  }

  const legacy = await firestore
    .collection("insumos")
    .where("empresaId", "==", empresaId)
    .where("lojaId", "==", lojaId)
    .get();

  return new Set(legacy.docs.map((doc) => doc.id));
}

function serializeDate(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return value ?? null;
}

function sanitizeAlert(id: string, data: DocumentData, administrative: boolean) {
  const base = {
    id,
    insumoId: typeof data.insumoId === "string" ? data.insumoId : undefined,
    insumoNome: typeof data.insumoNome === "string" ? data.insumoNome : undefined,
    estoqueAtual: Number(data.estoqueAtual) || 0,
    estoqueMinimo: Number(data.estoqueMinimo) || 0,
    estoqueMaximo: Number(data.estoqueMaximo) || 0,
    consumoDiario: Number(data.consumoDiario) || 0,
    diasCobertura: Number(data.diasCobertura) || 0,
    prazoEntrega: Number(data.prazoEntrega) || 0,
    diasPedido: Number(data.diasPedido) || 0,
    diasAtePedido: Number(data.diasAtePedido) || 0,
    limiteCritico: Number(data.limiteCritico) || 0,
    nivel: data.nivel === "critical" || data.nivel === "warning" || data.nivel === "info" ? data.nivel : "info",
    mensagem: String(data.mensagem || ""),
    acaoSugerida: typeof data.acaoSugerida === "string" ? data.acaoSugerida : null,
    qtdSugerida: Number(data.qtdSugerida) || 0,
    lido: Boolean(data.lido),
    resolvido: Boolean(data.resolvido),
    resolvidoPor: typeof data.resolvidoPor === "string" ? data.resolvidoPor : undefined,
    observacaoResolucao: typeof data.observacaoResolucao === "string" ? data.observacaoResolucao : undefined,
    criadoEm: serializeDate(data.criadoEm),
  };

  if (!administrative) return base;

  return {
    ...base,
    custoEstimado: Number(data.custoEstimado) || 0,
    economiaEstimada: Number(data.economiaEstimada) || 0,
    linkWhatsApp: typeof data.linkWhatsApp === "string" ? data.linkWhatsApp : null,
    melhorFornecedor: data.melhorFornecedor && typeof data.melhorFornecedor === "object"
      ? {
          fornecedorId: typeof data.melhorFornecedor.fornecedorId === "string" ? data.melhorFornecedor.fornecedorId : undefined,
          fornecedorNome: String(data.melhorFornecedor.fornecedorNome || ""),
          custo: Number(data.melhorFornecedor.custo) || 0,
          diasEntrega: Number(data.melhorFornecedor.diasEntrega) || 0,
        }
      : null,
  };
}

async function canUseAlert(empresaId: string, lojaId: string, insumoId: string | undefined) {
  if (!insumoId) return false;
  const ids = await tenantStockIds(empresaId, lojaId);
  return ids.has(insumoId);
}

export async function GET(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/dashboard");
  if (access.status !== 200) return errorResponse(access.status);

  try {
    const app = getAdminApp();
    if (!app) throw new Error("Firebase Admin não configurado.");

    const firestore = getFirestore(app);
    const [ids, snapshot] = await Promise.all([
      tenantStockIds(access.empresaId, access.lojaId),
      firestore.collection("alertas").where("resolvido", "==", false).get(),
    ]);
    const administrative = isAdministrativeRole(access.role);

    const items = snapshot.docs
      .filter((doc) => {
        const insumoId = doc.data().insumoId;
        return typeof insumoId === "string" && ids.has(insumoId);
      })
      .sort((a, b) => {
        const left = a.data().criadoEm?.toMillis?.() || 0;
        const right = b.data().criadoEm?.toMillis?.() || 0;
        return right - left;
      })
      .map((doc) => sanitizeAlert(doc.id, doc.data(), administrative));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Erro ao carregar alertas seguros:", error);
    return NextResponse.json({ error: "Não foi possível carregar os alertas." }, { status: 500 });
  }
}

type AlertAction = {
  action?: "read" | "resolve";
  alertaId?: string;
  observacao?: string;
};

export async function PATCH(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/dashboard");
  if (access.status !== 200) return errorResponse(access.status);

  const body = (await request.json().catch(() => ({}))) as AlertAction;
  if (!body.alertaId || (body.action !== "read" && body.action !== "resolve")) {
    return NextResponse.json({ error: "Ação de alerta inválida." }, { status: 400 });
  }

  try {
    const app = getAdminApp();
    if (!app) throw new Error("Firebase Admin não configurado.");

    const firestore = getFirestore(app);
    const ref = firestore.collection("alertas").doc(body.alertaId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return NextResponse.json({ error: "Alerta não encontrado." }, { status: 404 });
    }

    const data = snapshot.data() || {};
    if (!(await canUseAlert(access.empresaId, access.lojaId, typeof data.insumoId === "string" ? data.insumoId : undefined))) {
      return NextResponse.json({ error: "Alerta não pertence a esta loja." }, { status: 403 });
    }

    if (body.action === "read") {
      await ref.update({ lido: true });
    } else {
      await ref.update({
        lido: true,
        observacaoResolucao: body.observacao?.trim() || "Resolvido via painel",
        resolvido: true,
        resolvidoEm: FieldValue.serverTimestamp(),
        resolvidoPor: access.profile.uid,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro ao atualizar alerta seguro:", error);
    return NextResponse.json({ error: "Não foi possível atualizar o alerta." }, { status: 500 });
  }
}
