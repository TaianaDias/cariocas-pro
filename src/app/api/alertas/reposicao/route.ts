import { getFirestore, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { isAdministrativeRole } from "../../../../lib/access-control";
import { authorizeAppRequest, getAdminApp } from "../../../../lib/server-auth";

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function suggestedQuantity(insumo: DocumentData, consumoDiario: number) {
  const minimo = numberValue(insumo.estoqueMinimo);
  const maximo = numberValue(insumo.estoqueMaximo) || Math.max(minimo * 2, consumoDiario * 7);
  const atual = numberValue(insumo.quantidadeAtual ?? insumo.estoqueAtual);
  const padrao = numberValue(insumo.quantidadePadraoPedido) || 1;
  const quantidade = Math.max(maximo - atual, minimo);
  return Math.ceil(quantidade / padrao) * padrao;
}

function coverageDays(estoqueAtual: number, consumoDiario: number) {
  if (consumoDiario <= 0) return 999;
  return Math.floor(estoqueAtual / consumoDiario);
}

async function getTenantInsumo(empresaId: string, lojaId: string, insumoId: string) {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin não configurado.");
  const firestore = getFirestore(app);

  const nestedRef = firestore.collection("empresas").doc(empresaId).collection("insumos").doc(insumoId);
  const nested = await nestedRef.get();
  if (nested.exists) {
    const data = nested.data() || {};
    if (!data.lojaId || data.lojaId === lojaId) return { id: nested.id, data };
  }

  const legacy = await firestore.collection("insumos").doc(insumoId).get();
  if (!legacy.exists) return null;
  const data = legacy.data() || {};
  if (data.empresaId !== empresaId || data.lojaId !== lojaId) return null;
  return { id: legacy.id, data };
}

async function getDailyConsumption(empresaId: string, lojaId: string, insumoId: string) {
  const app = getAdminApp();
  if (!app) throw new Error("Firebase Admin não configurado.");
  const firestore = getFirestore(app);
  const since = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  const nested = await firestore
    .collection("empresas")
    .doc(empresaId)
    .collection("historicoEstoque")
    .where("insumoId", "==", insumoId)
    .where("criadoEm", ">=", since)
    .get();

  const docs = nested.empty
    ? (await firestore
        .collection("historico")
        .where("empresaId", "==", empresaId)
        .where("lojaId", "==", lojaId)
        .where("insumoId", "==", insumoId)
        .get()).docs
    : nested.docs;

  const total = docs.reduce((sum, item) => {
    const data = item.data();
    const tipo = String(data.tipo || data.tipoMovimentacao || "");
    if (!tipo.includes("saida") && tipo !== "producao") return sum;
    return sum + Math.abs(numberValue(data.quantidade));
  }, 0);

  return Math.round((total / 30) * 100) / 100;
}

function bestSupplier(insumo: DocumentData) {
  const fornecedores = Array.isArray(insumo.fornecedores) ? insumo.fornecedores : [];
  if (!fornecedores.length) return null;
  const principal = fornecedores.find((item: DocumentData) => Boolean(item.principal));
  if (principal) return principal;
  return [...fornecedores].sort((a: DocumentData, b: DocumentData) => {
    const custoA = numberValue(a.custoUnitario ?? a.custo);
    const custoB = numberValue(b.custoUnitario ?? b.custo);
    return custoA - custoB;
  })[0] || null;
}

export async function GET(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/reposicao");
  if (access.status !== 200) {
    return NextResponse.json({ error: access.status === 401 ? "Sessão inválida." : "Acesso não autorizado." }, { status: access.status });
  }

  const insumoId = request.nextUrl.searchParams.get("insumoId")?.trim();
  if (!insumoId) {
    return NextResponse.json({ error: "insumoId é obrigatório" }, { status: 400 });
  }

  try {
    const insumo = await getTenantInsumo(access.empresaId, access.lojaId, insumoId);
    if (!insumo) {
      return NextResponse.json({ error: "Insumo não encontrado nesta loja" }, { status: 404 });
    }

    const data = insumo.data;
    const consumoDiario = await getDailyConsumption(access.empresaId, access.lojaId, insumoId);
    const qtdSugerida = suggestedQuantity(data, consumoDiario);
    const estoqueAtual = numberValue(data.quantidadeAtual ?? data.estoqueAtual);
    const estoqueMinimo = numberValue(data.estoqueMinimo);
    const estoqueMaximo = numberValue(data.estoqueMaximo);
    const diasCobertura = coverageDays(estoqueAtual, consumoDiario);
    const prazoEntrega = numberValue(data.diasEntrega);
    const diasPedido = numberValue(data.diasPedido);
    const limiteCritico = prazoEntrega + diasPedido + 1;
    const nivel = estoqueAtual <= 0 || diasCobertura <= 1
      ? "critical"
      : diasCobertura <= limiteCritico || estoqueAtual <= estoqueMinimo
        ? "warning"
        : "info";
    const insumoNome = String(data.nome || "Insumo");
    const mensagem = nivel === "critical"
      ? `${insumoNome} está com estoque crítico`
      : nivel === "warning"
        ? `${insumoNome} precisa de reposição`
        : `${insumoNome} está dentro da cobertura esperada`;

    const base = {
      alerta: {
        acaoSugerida: `Repor ${Math.round(qtdSugerida)} ${String(data.unidadeCompra || data.unidadeMedida || "un")}`,
        consumoDiario,
        diasCobertura,
        estoqueAtual,
        estoqueMaximo,
        estoqueMinimo,
        insumoId,
        insumoNome,
        lido: false,
        mensagem,
        nivel,
        qtdSugerida: Math.round(qtdSugerida),
        resolvido: false,
      },
      consumoDiario,
      diasCobertura,
      estoqueAtual,
      estoqueMinimo,
      insumoId,
      insumoNome,
      qtdSugerida: Math.round(qtdSugerida),
    };

    if (!isAdministrativeRole(access.role)) {
      return NextResponse.json(base);
    }

    const fornecedor = bestSupplier(data);
    const custoFornecedor = fornecedor
      ? numberValue(fornecedor.custoUnitario ?? fornecedor.custo)
      : numberValue(data.custoCompra ?? data.custoUnitarioCompra);

    return NextResponse.json({
      ...base,
      alerta: {
        ...base.alerta,
        custoEstimado: Math.round(qtdSugerida * custoFornecedor * 100) / 100,
        melhorFornecedor: fornecedor
          ? {
              custo: custoFornecedor,
              diasEntrega: numberValue(fornecedor.diasEntrega),
              fornecedorId: String(fornecedor.fornecedorId || ""),
              fornecedorNome: String(fornecedor.fornecedorNome || ""),
            }
          : null,
      },
      melhorFornecedor: fornecedor
        ? {
            custo: custoFornecedor,
            diasEntrega: numberValue(fornecedor.diasEntrega),
            fornecedorId: String(fornecedor.fornecedorId || ""),
            fornecedorNome: String(fornecedor.fornecedorNome || ""),
          }
        : null,
    });
  } catch (error) {
    console.error("Erro ao calcular reposição segura:", error);
    return NextResponse.json({ error: "Erro ao calcular reposição" }, { status: 500 });
  }
}
