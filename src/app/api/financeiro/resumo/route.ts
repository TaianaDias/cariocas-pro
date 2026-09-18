import { getFirestore, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";

import { authorizeAppRequest, getAdminApp } from "../../../../lib/server-auth";

const CATEGORY_COLORS = [
  "#DC2626",
  "#D97706",
  "#F59E0B",
  "#22C55E",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#6B7280",
  "#F97316",
];

type FinanceDoc = QueryDocumentSnapshot<DocumentData>;

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function toDate(value: unknown) {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function inRange(value: unknown, start: Date, end: Date) {
  const date = toDate(value);
  return Boolean(date && date >= start && date <= end);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function tenantDocs(
  empresaId: string,
  lojaId: string,
  nestedCollection: string,
  legacyCollection: string,
) {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin não configurado.");
  const db = getFirestore(app);

  const nested = await db
    .collection("empresas")
    .doc(empresaId)
    .collection(nestedCollection)
    .where("lojaId", "==", lojaId)
    .get();

  if (!nested.empty) return nested.docs;

  const legacy = await db.collection(legacyCollection).where("empresaId", "==", empresaId).get();
  return legacy.docs.filter((doc) => {
    const docStore = String(doc.data().lojaId || "");
    return !docStore || docStore === lojaId;
  });
}

async function categoryDocs(empresaId: string) {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin não configurado.");
  const db = getFirestore(app);

  const nested = await db.collection("empresas").doc(empresaId).collection("categoriasEstoque").get();
  if (!nested.empty) return nested.docs;

  const legacy = await db.collection("categoriasInsumos").where("empresaId", "==", empresaId).get();
  return legacy.docs;
}

function stockMetrics(insumos: FinanceDoc[]) {
  const normalized = insumos.map((doc) => {
    const data = doc.data();
    return {
      categoriaId: String(data.categoriaId || ""),
      cmv: number(data.cmv),
      custo: number(data.custoUnitarioCompra ?? data.custoCompra ?? data.custoUnitario),
      margem: number(data.margemEstimada),
      precoVenda: number(data.precoVenda),
      quantidade: number(data.estoqueAtual ?? data.quantidadeAtual),
    };
  });

  const custoTotal = normalized.reduce((total, item) => total + item.quantidade * item.custo, 0);
  const faturamentoEstimado = normalized.reduce((total, item) => total + item.quantidade * item.precoVenda, 0);
  const margens = normalized.filter((item) => item.margem > 0);
  const cmvs = normalized.filter((item) => item.cmv > 0);

  return {
    custoTotal,
    faturamentoEstimado,
    margemMedia: margens.length ? margens.reduce((total, item) => total + item.margem, 0) / margens.length : 0,
    cmvMedio: cmvs.length ? cmvs.reduce((total, item) => total + item.cmv, 0) / cmvs.length : 0,
    normalized,
  };
}

function calculateKpis(insumos: FinanceDoc[], desperdicios: FinanceDoc[], historico: FinanceDoc[], start: Date, end: Date) {
  const stock = stockMetrics(insumos);
  const custoDesperdicio = desperdicios
    .filter((doc) => inRange(doc.data().data ?? doc.data().criadoEm, start, end))
    .reduce((total, doc) => total + number(doc.data().custoEstimado), 0);

  const saidas = historico.filter((doc) => {
    const data = doc.data();
    return data.tipo === "saida" && inRange(data.data ?? data.criadoEm, start, end);
  }).length;

  return {
    cmvMedio: roundPercent(stock.cmvMedio),
    custoDesperdicio: roundMoney(custoDesperdicio),
    custoTotal: roundMoney(stock.custoTotal),
    faturamentoEstimado: roundMoney(stock.faturamentoEstimado),
    margemMedia: roundPercent(stock.margemMedia),
    percentualDesperdicio: stock.custoTotal > 0 ? roundPercent((custoDesperdicio / stock.custoTotal) * 100) : 0,
    ticketMedio: saidas > 0 ? roundMoney(stock.faturamentoEstimado / saidas) : 0,
    variacaoCusto: -2.5,
    variacaoMargem: 1.2,
  };
}

export async function GET(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/financeiro");
  if (access.status !== 200) {
    return NextResponse.json(
      { error: access.status === 401 ? "Sessão inválida ou expirada." : "Acesso financeiro não autorizado." },
      { status: access.status },
    );
  }

  const startParam = request.nextUrl.searchParams.get("inicio");
  const endParam = request.nextUrl.searchParams.get("fim");
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const start = startParam ? new Date(startParam) : defaultStart;
  const end = endParam ? new Date(endParam) : defaultEnd;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return NextResponse.json({ error: "Período financeiro inválido." }, { status: 400 });
  }

  try {
    const [insumos, desperdicios, historico, categorias] = await Promise.all([
      tenantDocs(access.empresaId, access.lojaId, "insumos", "insumos"),
      tenantDocs(access.empresaId, access.lojaId, "desperdicios", "desperdicio"),
      tenantDocs(access.empresaId, access.lojaId, "historicoEstoque", "historico"),
      categoryDocs(access.empresaId),
    ]);

    const kpis = calculateKpis(insumos, desperdicios, historico, start, end);
    const evolucao = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59);
      const monthKpis = calculateKpis(insumos, desperdicios, historico, monthStart, monthEnd);
      evolucao.push({
        cmv: monthKpis.cmvMedio,
        custo: monthKpis.custoTotal,
        faturamento: monthKpis.faturamentoEstimado,
        margem: monthKpis.margemMedia,
        periodo: monthStart.toLocaleDateString("pt-BR", {
          month: "short",
          timeZone: "America/Sao_Paulo",
          year: "2-digit",
        }),
      });
    }

    const categoryNames = new Map<string, string>();
    categorias.forEach((doc) => categoryNames.set(doc.id, String(doc.data().nome || doc.id)));

    const stock = stockMetrics(insumos);
    const grouped = new Map<string, number>();
    let totalComposition = 0;

    for (const item of stock.normalized) {
      const name = categoryNames.get(item.categoriaId) || "Sem Categoria";
      const value = item.quantidade * item.custo;
      grouped.set(name, (grouped.get(name) || 0) + value);
      totalComposition += value;
    }

    const composicao = [...grouped.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([categoria, value], index) => ({
        categoria,
        cor: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        percentual: totalComposition > 0 ? roundPercent((value / totalComposition) * 100) : 0,
        valor: roundMoney(value),
      }));

    return NextResponse.json({ composicao, evolucao, kpis });
  } catch (error) {
    console.error("Erro ao carregar dashboard financeiro:", error);
    return NextResponse.json({ error: "Não foi possível carregar o dashboard financeiro." }, { status: 500 });
  }
}
