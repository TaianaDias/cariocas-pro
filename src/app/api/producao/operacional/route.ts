import { FieldValue, getFirestore, type DocumentData, type DocumentReference } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";

import { authorizeAppRequest, getAdminApp } from "../../../../lib/server-auth";

function authError(status: number) {
  return NextResponse.json(
    { error: status === 401 ? "Sessão inválida ou expirada." : "Acesso não autorizado à produção." },
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

function safeStock(id: string, data: DocumentData) {
  const quantidadeAtual = Number(data.quantidadeAtual ?? data.estoqueAtual) || 0;
  return {
    id,
    codigoBarras: String(data.codigoBarras || ""),
    marca: String(data.marca || ""),
    nome: String(data.nome || ""),
    quantidadeAtual,
    status: String(data.status || data.statusProduto || "ativo"),
    unidadeCompra: String(data.unidadeCompra || data.unidadeMedida || "un"),
    unidadeMedida: String(data.unidadeMedida || data.unidadeUso || data.unidadeCompra || "un"),
  };
}

function safePortion(id: string, data: DocumentData) {
  return {
    id,
    area: String(data.area || "producao"),
    criadoEm: toIso(data.criadoEm),
    formatoPorcao: String(data.formatoPorcao || "porcao"),
    insumoId: String(data.insumoId || data.insumoBrutoId || ""),
    insumoNome: String(data.insumoNome || data.insumoBrutoNome || ""),
    insumoPorcionadoId: String(data.insumoPorcionadoId || ""),
    insumoPorcionadoNome: String(data.insumoPorcionadoNome || ""),
    observacao: String(data.observacao || ""),
    porcoesDisponiveis: Number(data.porcoesDisponiveis) || 0,
    porcoesGeradas: Number(data.porcoesGeradas) || 0,
    quantidadeBaixada: Number(data.quantidadeBaixada) || 0,
    quantidadePorPorcao: Number(data.quantidadePorPorcao) || 0,
    responsavel: String(data.responsavel || ""),
    status: String(data.status || "disponivel"),
    unidade: String(data.unidade || "un"),
    unidadePorcao: String(data.unidadePorcao || data.unidade || "un"),
  };
}

function safeFicha(id: string, data: DocumentData) {
  return {
    id,
    codigo: String(data.codigo || ""),
    ingredientes: Array.isArray(data.ingredientes)
      ? data.ingredientes.map((item: Record<string, unknown>) => ({
          insumoId: String(item.insumoId || ""),
          insumoNome: String(item.insumoNome || ""),
          quantidade: Number(item.quantidade) || 0,
          unidade: String(item.unidade || "un"),
        }))
      : [],
    modoPreparo: String(data.modoPreparo || ""),
    nome: String(data.nome || ""),
    rendimento: Number(data.rendimento) || 0,
    unidade: String(data.unidade || "un"),
  };
}

function safeOrder(id: string, data: DocumentData) {
  return {
    id,
    dataFim: toIso(data.dataFim),
    dataInicio: toIso(data.dataInicio),
    dataProgramada: toIso(data.dataProgramada),
    fichaTecnicaId: String(data.fichaTecnicaId || ""),
    fichaTecnicaNome: String(data.fichaTecnicaNome || ""),
    observacao: String(data.observacao || ""),
    quantidadeProduzir: Number(data.quantidadeProduzir) || 0,
    quantidadeProduzida: Number(data.quantidadeProduzida) || 0,
    responsavel: String(data.responsavel || ""),
  };
}

async function resolveStockRef(empresaId: string, lojaId: string, insumoId: string) {
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

async function listStock(empresaId: string, lojaId: string) {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin não configurado.");
  const firestore = getFirestore(app);

  const nested = await firestore.collection("empresas").doc(empresaId).collection("insumos").where("lojaId", "==", lojaId).get();
  const docs = nested.empty
    ? (await firestore.collection("insumos").where("empresaId", "==", empresaId).where("lojaId", "==", lojaId).get()).docs
    : nested.docs;

  return docs
    .map((doc) => safeStock(doc.id, doc.data()))
    .filter((item) => item.quantidadeAtual > 0 && item.status !== "inativo")
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

async function listPortions(empresaId: string, lojaId: string) {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin não configurado.");
  const firestore = getFirestore(app);

  const nested = await firestore.collection("empresas").doc(empresaId).collection("porcoesProducao").where("lojaId", "==", lojaId).get();
  const docs = nested.empty
    ? (await firestore.collection("porcoes_producao").where("empresaId", "==", empresaId).where("lojaId", "==", lojaId).get()).docs
    : nested.docs;

  return docs
    .map((doc) => safePortion(doc.id, doc.data()))
    .filter((item) => item.porcoesDisponiveis > 0 && item.status !== "estornado")
    .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
}

async function listTenantDocuments(collectionName: string, empresaId: string, lojaId: string) {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin não configurado.");
  const firestore = getFirestore(app);
  const snapshot = await firestore.collection(collectionName).where("empresaId", "==", empresaId).where("lojaId", "==", lojaId).get();
  return snapshot.docs;
}

export async function GET(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/producao");
  if (access.status !== 200) return authError(access.status);

  try {
    const [estoque, porcoes, fichaDocs, ordemDocs] = await Promise.all([
      listStock(access.empresaId, access.lojaId),
      listPortions(access.empresaId, access.lojaId),
      listTenantDocuments("fichas_tecnicas", access.empresaId, access.lojaId),
      listTenantDocuments("ordens_producao", access.empresaId, access.lojaId),
    ]);

    return NextResponse.json({
      estoque,
      fichas: fichaDocs.map((doc) => safeFicha(doc.id, doc.data())),
      ordens: ordemDocs.map((doc) => safeOrder(doc.id, doc.data())),
      porcoes,
    });
  } catch (error) {
    console.error("Erro ao carregar produção operacional:", error);
    return NextResponse.json({ error: "Não foi possível carregar a produção operacional." }, { status: 500 });
  }
}

type ProductionBody = {
  area?: string;
  formatoPorcao?: string;
  insumoId?: string;
  insumoPorcionadoId?: string;
  observacao?: string;
  porcoes?: number;
  quantidade?: number;
  quantidadePorPorcao?: number;
};

export async function POST(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/producao");
  if (access.status !== 200) return authError(access.status);

  const body = (await request.json().catch(() => ({}))) as ProductionBody;
  const insumoId = body.insumoId?.trim();
  const insumoPorcionadoId = body.insumoPorcionadoId?.trim() || "";
  const quantidade = Number(body.quantidade);
  const porcoes = Math.floor(Number(body.porcoes));

  if (!insumoId || !Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(porcoes) || porcoes <= 0) {
    return NextResponse.json({ error: "Informe item, quantidade e número de porções." }, { status: 400 });
  }

  if (insumoPorcionadoId && insumoPorcionadoId === insumoId) {
    return NextResponse.json({ error: "O item porcionado precisa ser diferente do item bruto." }, { status: 400 });
  }

  try {
    const app = getAdminApp();
    if (!app) throw new Error("Firebase Admin não configurado.");
    const firestore = getFirestore(app);
    const brutoRef = await resolveStockRef(access.empresaId, access.lojaId, insumoId);
    const porcionadoRef = insumoPorcionadoId
      ? await resolveStockRef(access.empresaId, access.lojaId, insumoPorcionadoId)
      : null;

    if (!brutoRef) return NextResponse.json({ error: "Item bruto não encontrado nesta loja." }, { status: 404 });
    if (insumoPorcionadoId && !porcionadoRef) {
      return NextResponse.json({ error: "Item porcionado não encontrado nesta loja." }, { status: 404 });
    }

    const porcaoRef = firestore.collection("empresas").doc(access.empresaId).collection("porcoesProducao").doc();
    const historicoSaidaRef = firestore.collection("empresas").doc(access.empresaId).collection("historicoEstoque").doc();
    const historicoEntradaRef = porcionadoRef
      ? firestore.collection("empresas").doc(access.empresaId).collection("historicoEstoque").doc()
      : null;

    await firestore.runTransaction(async (transaction) => {
      const brutoSnapshot = await transaction.get(brutoRef as DocumentReference<DocumentData>);
      if (!brutoSnapshot.exists) throw new Error("Item bruto não encontrado.");
      const bruto = brutoSnapshot.data() || {};
      if (bruto.lojaId && bruto.lojaId !== access.lojaId) throw new Error("Loja inválida.");

      const saldoAtual = Number(bruto.quantidadeAtual ?? bruto.estoqueAtual) || 0;
      if (saldoAtual < quantidade) throw new Error("Estoque insuficiente para registrar a produção.");

      const custoUnitario = Number(bruto.custoUnitarioUso ?? bruto.custoUnitario ?? bruto.custoCompra) || 0;
      const custoTotal = Math.round(quantidade * custoUnitario * 100) / 100;
      const custoPorPorcao = porcoes > 0 ? custoTotal / porcoes : 0;
      const unidade = String(bruto.unidadeMedida || bruto.unidadeUso || bruto.unidadeCompra || "un");
      const insumoNome = String(bruto.nome || "Insumo");
      let insumoPorcionadoNome = "";

      transaction.update(brutoRef, {
        atualizadoEm: FieldValue.serverTimestamp(),
        estoqueAtual: saldoAtual - quantidade,
        quantidadeAtual: saldoAtual - quantidade,
      });

      if (porcionadoRef) {
        const porcionadoSnapshot = await transaction.get(porcionadoRef as DocumentReference<DocumentData>);
        if (!porcionadoSnapshot.exists) throw new Error("Item porcionado não encontrado.");
        const porcionado = porcionadoSnapshot.data() || {};
        if (porcionado.lojaId && porcionado.lojaId !== access.lojaId) throw new Error("Loja inválida.");

        const saldoPorcionado = Number(porcionado.quantidadeAtual ?? porcionado.estoqueAtual) || 0;
        insumoPorcionadoNome = String(porcionado.nome || "Item porcionado");
        transaction.update(porcionadoRef, {
          atualizadoEm: FieldValue.serverTimestamp(),
          custoUnitarioCompra: custoPorPorcao,
          custoUnitarioUso: custoPorPorcao,
          estoqueAtual: saldoPorcionado + porcoes,
          quantidadeAtual: saldoPorcionado + porcoes,
        });
      }

      const formatoPorcao = body.formatoPorcao?.trim() || "porcao";
      const area = body.area?.trim() || "producao";
      const quantidadePorPorcao = Number(body.quantidadePorPorcao) > 0
        ? Number(body.quantidadePorPorcao)
        : quantidade / porcoes;

      transaction.set(porcaoRef, {
        area,
        atualizadoEm: FieldValue.serverTimestamp(),
        criadoEm: FieldValue.serverTimestamp(),
        custoPorPorcao,
        custoTotal,
        custoUnitario,
        empresaId: access.empresaId,
        formatoPorcao,
        insumoBrutoId: insumoId,
        insumoBrutoNome: insumoNome,
        insumoId,
        insumoNome,
        insumoPorcionadoId,
        insumoPorcionadoNome,
        lojaId: access.lojaId,
        observacao: body.observacao?.trim() || `Porcionado em formato ${formatoPorcao}`,
        porcoesDisponiveis: porcoes,
        porcoesGeradas: porcoes,
        quantidadeBaixada: quantidade,
        quantidadePorPorcao,
        responsavel: access.profile.uid,
        status: "disponivel",
        unidade,
        unidadePorcao: unidade,
      });

      transaction.set(historicoSaidaRef, {
        criadoEm: FieldValue.serverTimestamp(),
        custoTotal,
        custoUnitario,
        data: FieldValue.serverTimestamp(),
        empresaId: access.empresaId,
        insumoId,
        insumoNome,
        lojaId: access.lojaId,
        observacao: `${porcoes} porções geradas para ${area}`,
        quantidade: -quantidade,
        responsavel: access.profile.uid,
        tipo: "saida_producao",
        tipoMovimentacao: "producao_saida",
        unidade,
        usuarioId: access.profile.uid,
      });

      if (porcionadoRef && historicoEntradaRef) {
        transaction.set(historicoEntradaRef, {
          criadoEm: FieldValue.serverTimestamp(),
          custoTotal,
          custoUnitario: custoPorPorcao,
          data: FieldValue.serverTimestamp(),
          empresaId: access.empresaId,
          insumoId: insumoPorcionadoId,
          insumoNome: insumoPorcionadoNome,
          lojaId: access.lojaId,
          observacao: `Entrada de porções geradas a partir de ${insumoNome}`,
          quantidade: porcoes,
          responsavel: access.profile.uid,
          tipo: "entrada_producao",
          tipoMovimentacao: "producao_entrada",
          unidade: "un",
          usuarioId: access.profile.uid,
        });
      }
    });

    return NextResponse.json({ id: porcaoRef.id, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível registrar a produção.";
    return NextResponse.json({ error: message }, { status: message.includes("insuficiente") ? 409 : 500 });
  }
}
