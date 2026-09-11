import { getFirestore, type DocumentData } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";

import { authorizeAppRequest, getAdminApp } from "../../../../lib/server-auth";

function toIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

function safeMovement(id: string, data: DocumentData) {
  return {
    id,
    data: toIso(data.data || data.criadoEm),
    insumoId: String(data.insumoId || ""),
    insumoNome: String(data.insumoNome || ""),
    observacao: String(data.observacao || ""),
    quantidade: Math.abs(Number(data.quantidade) || 0),
    responsavel: String(data.responsavel || data.usuarioId || ""),
    tipo: String(data.tipo || data.tipoMovimentacao || "movimentacao"),
    unidade: String(data.unidade || "un"),
  };
}

export async function GET(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/compras");
  if (access.status !== 200) {
    return NextResponse.json(
      { error: access.status === 401 ? "Sessão inválida ou expirada." : "Acesso não autorizado às movimentações." },
      { status: access.status },
    );
  }

  try {
    const app = getAdminApp();
    if (!app) throw new Error("Firebase Admin não configurado.");
    const firestore = getFirestore(app);

    const nested = await firestore
      .collection("empresas")
      .doc(access.empresaId)
      .collection("historicoEstoque")
      .where("lojaId", "==", access.lojaId)
      .get();

    const docs = nested.empty
      ? (await firestore
          .collection("historico")
          .where("empresaId", "==", access.empresaId)
          .where("lojaId", "==", access.lojaId)
          .get()).docs
      : nested.docs;

    const items = docs
      .map((doc) => safeMovement(doc.id, doc.data()))
      .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")))
      .slice(0, 100);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Erro ao carregar movimentações operacionais:", error);
    return NextResponse.json({ error: "Não foi possível carregar as movimentações." }, { status: 500 });
  }
}
