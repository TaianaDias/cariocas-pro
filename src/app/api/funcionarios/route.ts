import { getAuth, type UserRecord } from "firebase-admin/auth";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { isAdministrativeRole, operationalEmployeePermissions } from "../../../lib/access-control";
import { authorizeAppRequest, getAdminApp } from "../../../lib/server-auth";
import type { PermissaoFuncionario } from "../../../types";

type OperationalRole = "funcionario" | "gerente";

type FuncionarioPayload = {
  ativo?: boolean;
  cargo?: string;
  dataContratacao?: string | Date;
  email?: string;
  nome?: string;
  observacao?: string;
  permissoes?: PermissaoFuncionario[];
  role?: string;
  telefone?: string;
  turno?: string;
};

const allowedPermissions = new Set<PermissaoFuncionario>(operationalEmployeePermissions);
const allowedRoles = new Set<OperationalRole>(["funcionario", "gerente"]);

function text(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeEmail(value: unknown) {
  return text(value, 320).toLowerCase();
}

function normalizeRole(value: unknown): OperationalRole | null {
  const role = String(value || "funcionario") as OperationalRole;
  return allowedRoles.has(role) ? role : null;
}

function normalizePermissions(value: unknown): PermissaoFuncionario[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is PermissaoFuncionario => typeof item === "string" && allowedPermissions.has(item as PermissaoFuncionario)))];
}

function normalizeDate(value: unknown) {
  if (!value) return new Date();
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return null;
}

function serializeFuncionario(id: string, data: DocumentData) {
  return {
    id,
    ativo: data.ativo !== false,
    cargo: text(data.cargo),
    criadoEm: toIso(data.criadoEm),
    dataContratacao: toIso(data.dataContratacao),
    email: normalizeEmail(data.email),
    nome: text(data.nome),
    observacao: text(data.observacao, 1000),
    permissoes: normalizePermissions(data.permissoes),
    role: normalizeRole(data.role) || "funcionario",
    telefone: text(data.telefone, 40),
    turno: text(data.turno, 80),
    uid: text(data.uid || id, 160),
  };
}

async function authorizeAdmin(request: NextRequest) {
  const access = await authorizeAppRequest(request, "/funcionarios");
  if (access.status !== 200) return access;
  if (!isAdministrativeRole(access.role)) {
    return { reason: "forbidden" as const, status: 403 as const };
  }
  return access;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function findUserByEmail(auth: ReturnType<typeof getAuth>, email: string): Promise<UserRecord | null> {
  try {
    return await auth.getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: string })?.code === "auth/user-not-found") return null;
    throw error;
  }
}

async function assertTargetProfileIsSafe(
  db: ReturnType<typeof getFirestore>,
  uid: string,
  empresaId: string,
  lojaId: string,
) {
  const snap = await db.collection("usuarios").doc(uid).get();
  if (!snap.exists) return { exists: false as const };

  const data = snap.data() || {};
  const role = normalizeRole(data.role);
  if (!role || data.empresaId !== empresaId || (data.lojaId && data.lojaId !== lojaId)) {
    return { exists: true as const, safe: false as const };
  }

  return { exists: true as const, safe: true as const };
}

export async function GET(request: NextRequest) {
  const access = await authorizeAdmin(request);
  if (access.status !== 200) return errorResponse("Acesso não autorizado.", access.status);

  const app = getAdminApp();
  if (!app) return errorResponse("Firebase Admin não configurado no servidor.", 500);

  const db = getFirestore(app);
  const id = text(request.nextUrl.searchParams.get("id"), 180);

  if (id) {
    const snap = await db.collection("funcionarios").doc(id).get();
    if (!snap.exists) return errorResponse("Funcionário não encontrado.", 404);
    const data = snap.data() || {};
    if (data.empresaId !== access.empresaId || data.lojaId !== access.lojaId) {
      return errorResponse("Funcionário não encontrado.", 404);
    }
    return NextResponse.json({ funcionario: serializeFuncionario(snap.id, data) });
  }

  const snapshot = await db.collection("funcionarios").where("empresaId", "==", access.empresaId).get();
  const funcionarios = snapshot.docs
    .filter((doc) => doc.data().lojaId === access.lojaId)
    .map((doc) => serializeFuncionario(doc.id, doc.data()))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return NextResponse.json({ funcionarios });
}

export async function POST(request: NextRequest) {
  const access = await authorizeAdmin(request);
  if (access.status !== 200) return errorResponse("Acesso não autorizado.", access.status);

  const app = getAdminApp();
  if (!app) return errorResponse("Firebase Admin não configurado no servidor.", 500);

  const body = (await request.json().catch(() => ({}))) as FuncionarioPayload;
  const nome = text(body.nome);
  const email = normalizeEmail(body.email);
  const role = normalizeRole(body.role);
  const permissoes = normalizePermissions(body.permissoes);

  if (!nome) return errorResponse("Informe o nome do funcionário.", 400);
  if (!email) return errorResponse("Informe o e-mail usado no login do funcionário.", 400);
  if (!role) return errorResponse("Papel de funcionário inválido.", 400);
  if (!permissoes.length) return errorResponse("Libere pelo menos um módulo operacional.", 400);

  const auth = getAuth(app);
  const db = getFirestore(app);
  let user = await findUserByEmail(auth, email);
  let createdAuthUser = false;

  if (user) {
    const target = await assertTargetProfileIsSafe(db, user.uid, access.empresaId, access.lojaId);
    if (!target.exists || !target.safe) {
      return errorResponse("Este e-mail já pertence a outra conta e não pode ser vinculado à equipe.", 409);
    }
  } else {
    user = await auth.createUser({
      disabled: body.ativo === false,
      displayName: nome,
      email,
      emailVerified: false,
    });
    createdAuthUser = true;
  }

  const now = FieldValue.serverTimestamp();
  const funcionarioRef = db.collection("funcionarios").doc(user.uid);
  const usuarioRef = db.collection("usuarios").doc(user.uid);

  try {
    const batch = db.batch();
    batch.set(
      funcionarioRef,
      {
        ativo: body.ativo !== false,
        cargo: text(body.cargo),
        criadoEm: now,
        dataContratacao: normalizeDate(body.dataContratacao),
        email,
        empresaId: access.empresaId,
        lojaId: access.lojaId,
        nome,
        observacao: text(body.observacao, 1000),
        permissoes,
        role,
        telefone: text(body.telefone, 40),
        turno: text(body.turno, 80),
        uid: user.uid,
        atualizadoEm: now,
      },
      { merge: true },
    );
    batch.set(
      usuarioRef,
      {
        ativo: body.ativo !== false,
        criadoEm: now,
        email,
        empresaId: access.empresaId,
        funcionarioAtivo: body.ativo !== false,
        lojaId: access.lojaId,
        nome,
        permissoes,
        role,
        uid: user.uid,
        updatedAt: now,
      },
      { merge: true },
    );
    await batch.commit();
  } catch (error) {
    if (createdAuthUser) await auth.deleteUser(user.uid).catch(() => undefined);
    throw error;
  }

  if (!createdAuthUser) {
    await auth.updateUser(user.uid, { disabled: body.ativo === false, displayName: nome }).catch(() => undefined);
  }

  return NextResponse.json({ id: user.uid, novoAcesso: createdAuthUser }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const access = await authorizeAdmin(request);
  if (access.status !== 200) return errorResponse("Acesso não autorizado.", access.status);

  const app = getAdminApp();
  if (!app) return errorResponse("Firebase Admin não configurado no servidor.", 500);

  const body = (await request.json().catch(() => ({}))) as FuncionarioPayload & { id?: string };
  const id = text(body.id, 180);
  if (!id) return errorResponse("Funcionário não informado.", 400);

  const db = getFirestore(app);
  const funcionarioRef = db.collection("funcionarios").doc(id);
  const funcionarioSnap = await funcionarioRef.get();
  if (!funcionarioSnap.exists) return errorResponse("Funcionário não encontrado.", 404);

  const current = funcionarioSnap.data() || {};
  if (current.empresaId !== access.empresaId || current.lojaId !== access.lojaId) {
    return errorResponse("Funcionário não encontrado.", 404);
  }

  const uid = text(current.uid || id, 180);
  const role = normalizeRole(body.role ?? current.role);
  const permissoes = normalizePermissions(body.permissoes ?? current.permissoes);
  const nome = text(body.nome ?? current.nome);
  const email = normalizeEmail(body.email ?? current.email);
  const ativo = body.ativo ?? current.ativo !== false;

  if (!role) return errorResponse("Papel de funcionário inválido.", 400);
  if (!nome || !email) return errorResponse("Nome e e-mail são obrigatórios.", 400);
  if (ativo && !permissoes.length) return errorResponse("Libere pelo menos um módulo operacional.", 400);

  const target = await assertTargetProfileIsSafe(db, uid, access.empresaId, access.lojaId);
  if (!target.exists || !target.safe) return errorResponse("Perfil de acesso do funcionário está inconsistente.", 409);

  const auth = getAuth(app);
  await auth.updateUser(uid, { disabled: !ativo, displayName: nome, email });

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(
    funcionarioRef,
    {
      ativo,
      cargo: text(body.cargo ?? current.cargo),
      email,
      nome,
      observacao: text(body.observacao ?? current.observacao, 1000),
      permissoes: ativo ? permissoes : [],
      role,
      telefone: text(body.telefone ?? current.telefone, 40),
      turno: text(body.turno ?? current.turno, 80),
      atualizadoEm: now,
    },
    { merge: true },
  );
  batch.set(
    db.collection("usuarios").doc(uid),
    {
      ativo,
      email,
      empresaId: access.empresaId,
      funcionarioAtivo: ativo,
      lojaId: access.lojaId,
      nome,
      permissoes: ativo ? permissoes : [],
      role,
      updatedAt: now,
    },
    { merge: true },
  );
  await batch.commit();

  if (!ativo) await auth.revokeRefreshTokens(uid).catch(() => undefined);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const access = await authorizeAdmin(request);
  if (access.status !== 200) return errorResponse("Acesso não autorizado.", access.status);

  const app = getAdminApp();
  if (!app) return errorResponse("Firebase Admin não configurado no servidor.", 500);

  const id = text(request.nextUrl.searchParams.get("id"), 180);
  if (!id) return errorResponse("Funcionário não informado.", 400);

  const db = getFirestore(app);
  const funcionarioRef = db.collection("funcionarios").doc(id);
  const snap = await funcionarioRef.get();
  if (!snap.exists) return errorResponse("Funcionário não encontrado.", 404);

  const current = snap.data() || {};
  if (current.empresaId !== access.empresaId || current.lojaId !== access.lojaId) {
    return errorResponse("Funcionário não encontrado.", 404);
  }

  const uid = text(current.uid || id, 180);
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(funcionarioRef, { ativo: false, permissoes: [], atualizadoEm: now }, { merge: true });
  batch.set(
    db.collection("usuarios").doc(uid),
    { ativo: false, funcionarioAtivo: false, permissoes: [], updatedAt: now },
    { merge: true },
  );
  await batch.commit();

  const auth = getAuth(app);
  await auth.updateUser(uid, { disabled: true }).catch(() => undefined);
  await auth.revokeRefreshTokens(uid).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
