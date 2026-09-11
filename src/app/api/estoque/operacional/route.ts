import { FieldValue, getFirestore, type DocumentData, type DocumentReference } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";

import { authorizeAppRequest, getAdminApp } from "../../../../lib/server-auth";

function unauthorizedResponse(status: number) {
  return NextResponse.json(
    { error: status === 401 ? "Sessão inválida ou expirada." : "Acesso não autorizado ao estoque." },
    { status },
  );
}

function operationalInsumo(id: string, data: DocumentData) {
  const quantidadeAtual = Number(data.quantidadeAtual ?? data.estoqueAtual) || 0;
  const estoqueMinimo = Number(data.estoqueMinimo) || 0;
  const estoqueMaximo = Number(data.estoqueMaximo) || 0;

  return {
    id,
    nome: String(data.nome || ""),
    sku: String(data.sku || ""),
    codigoBarras: String(data.codigoBarras || ""),
    codigoBarrasNormalizado: String(data.codigoBarrasNormalizado || ""),
    marca: String(data.marca || ""),
    categoriaId: String(data.categoriaId || ""),
    status: String(data.status || "ativo"),
    statusProduto: String(data.statusProduto || "ativo"),
    imagemUrl: String(data.imagemUrl || ""),
    imagemUploadUrl: String(data.imagemUploadUrl || ""),
    imagemCosmosUrl: String(data.imagemCosmosUrl || ""),
    imagemPrincipal: String(data.imagemPrincipal || ""),
    quantidadeAtual,
    estoqueAtual: quantidadeAtual,
    estoqueMinimo,
    estoqueMaximo,
    localArmazenamento: String(data.localArmazenamento || ""),
    unidadeMedida: String(data.unidadeMedida || data.unidadeUso || data.unidadeCompra || "unidade"),
    unidadeCompra: String(data.unidadeCompra || data.unidadeMedida || "unidade"),
    unidadeUso: String(data.unidadeUso || data.unidadeMedida || "unidade"),
    conversao: Number(data.conversao ?? data.fatorConversao) || 1,
    fatorConversao: Number(data.fatorConversao ?? data.conversao) || 1,
    validadeOriginal: Number(data.validadeOriginal) || 0,
    validadeAposAberto: Number(data.validadeAposAberto) || 0,
    validadeAposProducao: Number(data.validadeAposProducao) || 0,
    loteInterno: String(data.loteInterno || ""),
    frequenciaPedido: String(data.frequenciaPedido || ""),
    diasPedido: Number(data.diasPedido) || 0,
    diasEntrega: Number(data.diasEntrega) || 0,
    quantidadePadraoPedido: Number(data.quantidadePadraoPedido) || 0,
    responsavel: String(data.responsavel || ""),
    observacao: String(data.observacao || ""),
    tipoEtiqueta: String(data.tipoEtiqueta || ""),
    etiquetaResponsavel: String(data.etiquetaResponsavel || ""),
    etiquetaObservacao: String(data.etiquetaObservacao || ""),
    fichaTecnicaVinculos: Array.isArray(data.fichaTecnicaVinculos) ? data.fichaTecnicaVinculos : [],
    fichaTecnicaObservacoes: String(data.fichaTecnicaObservacoes || ""),
    promocaoAtiva: false,
    precosVenda: [],
    margemEstimada: 0,
    cmv: 0,
    custoCompra: 0,
    custoUnitarioCompra: 0,
    custoUnitarioUso: 0,
    custoUnitario: 0,
    createdBy: "",
    criadoEm: null,
    atualizadoEm: null,
  };
}

async function listOperationalStock(empresaId: string, lojaId: string) {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin não configurado.");

  const firestore = getFirestore(app);
  const nestedRef = firestore.collection("empresas").doc(empresaId).collection("insumos");
  const nestedSnapshot = await nestedRef.where("lojaId", "==", lojaId).get();

  if (!nestedSnapshot.empty) {
    return nestedSnapshot.docs.map((doc) => operationalInsumo(doc.id, doc.data()));
  }

  const legacySnapshot = await firestore
    .collection("insumos")
    .where("empresaId", "==", empresaId)
    .where("lojaId", "==", lojaId)
    .get();

  return legacySnapshot.docs.map((doc) => operationalInsumo(doc.id, doc.data()));
}

async function resolveInsumoRef(empresaId: string, lojaId: string, insumoId: string) {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin não configurado.");

  const firestore = getFirestore(app);
  const nestedRef = firestore.collection("empresas").doc(empresaId).collection("insumos").doc(insumoId);
  const nestedSnapshot = await nestedRef.get();

  if (nestedSnapshot.exists) {
    const data = nestedSnapshot.data();
    if (data?.lojaId && data.lojaId !== lojaId) return null;
    return nestedRef;
  }

  const legacyRef = firestore.collection("insumos").doc(insumoId);
  const legacySnapshot = await legacyRef.get();
  if (!legacySnapshot.exists) return null;

  const data = legacySnapshot.data();
  if (data?.empresaId !== empresaId || data?.lojaId !== lojaId) return null;
  return legacyRef;
}

export async function GET(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/estoque");
  if (access.status !== 200) return unauthorizedResponse(access.status);

  try {
    const codigo = request.nextUrl.searchParams.get("codigo")?.replace(/\D/g, "") || "";
    const items = await listOperationalStock(access.empresaId, access.lojaId);
    const filtered = codigo
      ? items.filter((item) => (item.codigoBarrasNormalizado || item.codigoBarras.replace(/\D/g, "")) === codigo)
      : items;

    return NextResponse.json({ items: filtered });
  } catch (error) {
    console.error("Erro ao carregar estoque operacional:", error);
    return NextResponse.json({ error: "Não foi possível carregar o estoque operacional." }, { status: 500 });
  }
}

type MovimentoBody = {
  insumoId?: string;
  observacao?: string;
  quantidade?: number;
  tipo?: "entrada" | "saida";
};

export async function POST(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/estoque");
  if (access.status !== 200) return unauthorizedResponse(access.status);

  const body = (await request.json().catch(() => ({}))) as MovimentoBody;
  const quantidade = Number(body.quantidade);
  const tipo = body.tipo;
  const insumoId = body.insumoId?.trim();

  if (!insumoId || !Number.isFinite(quantidade) || quantidade <= 0 || (tipo !== "entrada" && tipo !== "saida")) {
    return NextResponse.json({ error: "Movimentação inválida." }, { status: 400 });
  }

  try {
    const app = getAdminApp();
    if (!app) throw new Error("Firebase Admin não configurado.");

    const firestore = getFirestore(app);
    const insumoRef = await resolveInsumoRef(access.empresaId, access.lojaId, insumoId);
    if (!insumoRef) {
      return NextResponse.json({ error: "Insumo não encontrado nesta loja." }, { status: 404 });
    }

    const historyRef = firestore.collection("empresas").doc(access.empresaId).collection("historicoEstoque").doc();

    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(insumoRef as DocumentReference<DocumentData>);
      if (!snapshot.exists) throw new Error("Insumo não encontrado.");

      const data = snapshot.data() || {};
      if (data.lojaId && data.lojaId !== access.lojaId) throw new Error("Loja inválida.");

      const atual = Number(data.quantidadeAtual ?? data.estoqueAtual) || 0;
      const proxima = tipo === "entrada" ? atual + quantidade : atual - quantidade;

      if (proxima < 0) {
        throw new Error("Estoque insuficiente para registrar a saída.");
      }

      transaction.update(insumoRef, {
        atualizadoEm: FieldValue.serverTimestamp(),
        estoqueAtual: proxima,
        quantidadeAtual: proxima,
      });

      transaction.set(historyRef, {
        criadoEm: FieldValue.serverTimestamp(),
        data: FieldValue.serverTimestamp(),
        empresaId: access.empresaId,
        lojaId: access.lojaId,
        insumoId,
        insumoNome: String(data.nome || ""),
        observacao: body.observacao?.trim() || "Movimentação operacional",
        quantidade,
        responsavel: access.profile.uid,
        tipo,
        tipoMovimentacao: tipo === "entrada" ? "entrada_manual" : "saida",
        unidade: String(data.unidadeMedida || data.unidadeUso || "unidade"),
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar a movimentação.";
    const status = message.includes("insuficiente") ? 409 : 500;
    console.error("Erro ao registrar movimento operacional:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
