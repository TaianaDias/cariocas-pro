import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { getAdminApp } from "../../../lib/server-auth";

const DEFAULT_PLAN = "free";
const DEFAULT_STORE_ID = "matriz";

const DEFAULT_STOCK_CATEGORIES = [
  { cor: "#DC2626", icone: "C", id: "carnes", nome: "Carnes", ordem: 1 },
  { cor: "#D97706", icone: "P", id: "paes", nome: "Paes", ordem: 2 },
  { cor: "#F59E0B", icone: "Q", id: "queijos", nome: "Queijos", ordem: 3 },
  { cor: "#8B5CF6", icone: "M", id: "molhos", nome: "Molhos", ordem: 4 },
  { cor: "#22C55E", icone: "H", id: "hortifruti", nome: "Hortifruti", ordem: 5 },
  { cor: "#3B82F6", icone: "B", id: "bebidas", nome: "Bebidas", ordem: 6 },
  { cor: "#6B7280", icone: "E", id: "embalagens", nome: "Embalagens", ordem: 7 },
  { cor: "#EC4899", icone: "L", id: "limpeza", nome: "Limpeza", ordem: 8 },
  { cor: "#F97316", icone: "P", id: "producao-propria", nome: "Producao Propria", ordem: 9 },
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
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const app = getAdminApp();
  if (!app) {
    return NextResponse.json({ error: "Firebase Admin nao configurado no servidor." }, { status: 500 });
  }

  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");
  const decoded = await getAuth(app).verifyIdToken(token).catch(() => null);

  if (!decoded?.uid) {
    return NextResponse.json({ error: "Token invalido." }, { status: 401 });
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
  const empresaId = normalizeText(existingUser.empresaId, uid);
  const lojaId = normalizeText(existingUser.lojaId, DEFAULT_STORE_ID);
  const email = normalizeText(existingUser.email || decoded.email, "");
  const nome = normalizeText(existingUser.nome || decoded.name || body.nome, "Usuario");
  const tipoConta = normalizeText(existingUser.tipoConta || body.tipoConta, "Hamburgueria / Restaurante");
  const nomeFantasia = normalizeText(body.nomeFantasia || existingUser.nomeFantasia || tipoConta, "Carioca's Pro");
  const plano = normalizeText(existingUser.plano || existingUser.plan, DEFAULT_PLAN);
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  const empresaRef = db.collection("empresas").doc(empresaId);
  const lojaRef = empresaRef.collection("lojas").doc(lojaId);

  batch.set(
    empresaRef,
    {
      cnpj: normalizeText(body.cnpj, ""),
      criadoEm: now,
      id: empresaId,
      nomeFantasia,
      plano,
      razaoSocial: normalizeText(body.razaoSocial, ""),
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
      ativo: true,
      email,
      empresaId,
      funcionarioAtivo: true,
      lojaId,
      nome,
      permissoes: ["*"],
      plan: plano,
      plano,
      role: "dono",
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
    role: "dono",
    uid,
  });
}
