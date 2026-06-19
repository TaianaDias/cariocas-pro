import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";

import { canAccessPrecificacao, hasPrecificacaoPermission, normalizePlan, normalizeRole } from "./permissions";
import type { PrecificacaoPermission } from "./permissions";

type ServerUserProfile = {
  email?: string;
  empresaId?: string;
  lojaId?: string;
  plan?: string;
  plano?: string;
  role?: string;
  uid: string;
};

export function getAdminApp(): App | null {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId) {
    return null;
  }

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ clientEmail, privateKey, projectId }),
      projectId,
    });
  }

  return initializeApp({ projectId });
}

export async function getServerUserProfile(request: NextRequest): Promise<ServerUserProfile | null> {
  try {
    const authorization = request.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : null;

    if (!token) {
      return null;
    }

    const app = getAdminApp();
    if (!app) {
      return null;
    }

    const decoded = await getAuth(app).verifyIdToken(token).catch(() => null);
    if (!decoded?.uid) {
      return null;
    }

    const uid = decoded.uid;
    const snap = await getFirestore(app).collection("usuarios").doc(uid).get();
    if (!snap.exists) {
      return null;
    }

    return { uid, ...snap.data() } as ServerUserProfile;
  } catch {
    return null;
  }
}

export async function authorizePrecificacaoRequest(
  request: NextRequest,
  permission: PrecificacaoPermission,
  empresaId?: string | null,
  lojaId?: string | null,
) {
  const profile = await getServerUserProfile(request);

  if (!profile) {
    return { reason: "unauthenticated" as const, status: 401 as const };
  }

  const plan = normalizePlan(profile.plano || profile.plan);
  const role = normalizeRole(profile.role);
  const userEmpresaId = profile.empresaId || profile.uid;
  const userLojaId = profile.lojaId;

  if (!empresaId) {
    return { reason: "missing-empresa" as const, status: 400 as const };
  }

  if (!canAccessPrecificacao(plan, role) || !hasPrecificacaoPermission(permission, plan, role)) {
    return { reason: "forbidden" as const, status: 403 as const };
  }

  if (empresaId !== userEmpresaId) {
    return { reason: "cross-tenant" as const, status: 403 as const };
  }

  if (lojaId && userLojaId && lojaId !== userLojaId) {
    return { reason: "cross-store" as const, status: 403 as const };
  }

  return {
    empresaId: userEmpresaId,
    lojaId: lojaId || userLojaId,
    plan,
    profile,
    role,
    status: 200 as const,
  };
}
