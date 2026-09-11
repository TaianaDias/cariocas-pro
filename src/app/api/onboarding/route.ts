import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { getAdminApp } from "../../../lib/server-auth";

const DEFAULT_PLAN = "free";
const DEFAULT_STORE_ID = "matriz";
const ADMIN_ROLES = new Set(["admin", "dono", "proprietario", "user"]);
const OPERATIONAL_ROLES = new Set(["gerente", "funcionario"]);

const DEFAULT_STOCK_CATEGORIES = [
  { cor: "#DC2626", icone: "C", id: "carnes", nome: "Carnes", ordem: 1 },
  { cor: "#D97706", icone: "P", id: "paes", nome: "Pães", ordem: 2 },
  { cor: "#F59E0B", icone: "Q", id: "queijos", nome: "Queijos", ordem: 3 },
  { cor: "#8B5CF6", icone: "M", id: "molhos", nome: "Molhos", ordem: 4 },
  { cor: "#22C55E", icone: "H", id: "hortifruti", nome: "Hortifruti", ordem: 5 },
  { cor: "#3B82F6", icone: "B", id: "bebidas", nome: "Bebidas", ordem: 6 },
  { cor: "#6B7280", icone: "E", id: "embalagens", nome: "Embalagens", ordem: 7 },
  { cor: "#EC4899", icone: "L", id: "limpeza", nome: "Limpeza", ordem: 8 },
  { cor: "#F97316", icone: "P", id: "producao-propria", nome: "Produção Própria", ordem: 9 },
] as const;

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
}

function normalizeText(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return text || fallback;
}

export async function POST(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const app = getAdminApp();
  if (!app) {
    return NextResponse.json({ error: "Firebase Admin não configurado no servidor." }, { status: 500 });
  }

  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");
  const decoded = await getAuth(app).verifyIdToken(token).catch(() => null);

  if (!decoded?.uid) {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    nome?: string;
    nomeFantasia?: string;
    razaoSocial?: string;
    cnpj?: string;
    tipoConta?: string;
  };
  const db = getFirestore(app);
  const uid = decoded.uid;
  const userRef = db.collection("usuarios").doc(uid);
  const userSnap = await userRef.get();
  const existingUser = userSnap.exists ? userSnap.data() || {} : {};
  const existingRole = normalizeText(existingUser.role, "");

  // Perfis operacionais são criados e mantidos exclusivamente pela API de equipe.
  // O onboarding nunca pode transformar um funcionário/gerente em dono do tenant.
  if (userSnap.exists && OPERATIONAL_ROLES.has(existingRole)) {
    const empresaId = normalizeText(existingUser.empresaId, "");
    const lojaId = normalizeText(existingUser.lojaId, "");
    if (!empresaId || !lojaId) {
      return NextResponse.json({ error: "Perfil operacional sem empresa ou loja vinculada." }, { status: 403 });
    }

    return NextResponse.json({
      empresaId,
      lojaId,
      ok: true,
      plano: normalizeText(existingUser.plano || existingUser.plan, DEFAULT_PLAN),
      role: existingRole,
      skipped: true,
      uid,
    });
  }

  if (userSnap.exists && existingRole && !ADMIN_ROLES.has(existingRole)) {
    return NextResponse.json({ error: "Papel de usuário inválido para onboarding." }, { status: 403 });
  }

  const role = existingRole || "dono";
  const empresaId = normalizeText(existingUser.empresaId, uid);
  const lojaId = normalizeText(existingUser.lojaId, DEFAULT_STORE_ID);
  const email = normalizeText(existingUser.email || decoded.email, "");
  const nome = normalizeText(existingUser.nome || decoded.name || body.nome, "Usuário");
  const tipoConta = normalizeText(existingUser.tipoConta || body.tipoConta, "Hamburgueria / Restaurante");
  const nomeFantasia = normalizeText(body.nomeFantasia || existingUser.nomeFantasia || tipoConta, "Carioca's Pro");
  const plano = normalizeText(existingUser.plano || existingUser.plan, DEFAULT_PLAN);
  const permissoes = Array.isArray(existingUser.permissoes) && existingUser.permissoes.length ? existingUser.permissoes : ["*"];
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  const empresaRef = db.collection("empresas").doc(empresaId);
  const lojaRef = empresaRef.collection("lojas").doc(lojaId);

  batch.set(
    empresaRef,
    {
      cnpj: normalizeText(body.cnpj || existingUser.cnpj, ""),
      criadoEm: existingUser.criadoEm || now,
      id: empresaId,
      nomeFantasia,
      plano,
      razaoSocial: normalizeText(body.razaoSocial || existingUser.razaoSocial, ""),
      status: "ativo",
      atualizadoEm: now,
    },
    { merge: true },
  );

  batch.set(
    lojaRef,
    {
      configuracoes: {
        cmvAlvo: 32,
        diasAlertaValidade: 3,
        margemIdeal: 35,
        notificarEstoqueBaixo: true,
        notificarVencimento: true,
        notificarWhatsApp: false,
      },
      criadoEm: now,
      id: lojaId,
      matriz: true,
      nome: "Matriz",
      status: "ativo",
      atualizadoEm: now,
    },
    { merge: true },
  );

  for (const category of DEFAULT_STOCK_CATEGORIES) {
    batch.set(
      empresaRef.collection("categoriasEstoque").doc(category.id),
      {
        ...category,
        ativo: true,
        criadoEm: now,
        empresaId,
        lojaId,
        nomeNormalizado: category.id,
        atualizadoEm: now,
      },
      { merge: true },
    );
  }

  batch.set(
    userRef,
    {
      ativo: existingUser.ativo !== false,
      email,
      empresaId,
      funcionarioAtivo: existingUser.funcionarioAtivo !== false,
      lojaId,
      nome,
      permissoes,
      plan: plano,
      plano,
      role,
      tipoConta,
      uid,
      ultimoAcesso: now,
      updatedAt: now,
    },
    { merge: true },
  );

  await batch.commit();

  return NextResponse.json({
    empresaId,
    lojaId,
    ok: true,
    plano,
    role,
    uid,
  });
}
