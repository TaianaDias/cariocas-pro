import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Unsubscribe,
  type User,
  type UserCredential,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../lib/firebase";
import type { PermissaoFuncionario } from "../types";

export type UserProfile = {
  uid: string;
  nome: string;
  email: string;
  tipoConta: string;
  plano: "free" | "essencial" | "pro" | "plus" | "full";
  plan: "free" | "essencial" | "pro" | "plus" | "full";
  role: "admin" | "dono" | "proprietario" | "gerente" | "funcionario" | "user";
  empresaId?: string;
  lojaId?: string;
  permissoes?: PermissaoFuncionario[];
  ativo?: boolean;
  funcionarioAtivo?: boolean;
  createdAt?: unknown;
  criadoEm?: unknown;
  ultimoAcesso?: unknown;
  updatedAt?: unknown;
};

export async function ensureUserProfile(user: User, nome?: string, tipoConta = "Hamburgueria / Restaurante") {
  const profileRef = doc(db, "usuarios", user.uid);
  const profileSnap = await getDoc(profileRef);

  if (profileSnap.exists()) {
    const existingProfile = profileSnap.data() as UserProfile;

    await setDoc(
      profileRef,
      {
        ultimoAcesso: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return existingProfile;
  }

  const profile: UserProfile = {
    uid: user.uid,
    nome: nome || user.displayName || "Usuario",
    email: user.email || "",
    tipoConta,
    plano: "free",
    plan: "free",
    role: "dono",
    ativo: true,
    empresaId: user.uid,
    lojaId: "matriz",
    permissoes: ["*"],
    funcionarioAtivo: true,
    createdAt: serverTimestamp(),
    criadoEm: serverTimestamp(),
    ultimoAcesso: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(profileRef, profile);
  return profile;
}

export async function getUserProfile(uid: string) {
  const profileRef = doc(db, "usuarios", uid);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    return null;
  }

  return profileSnap.data() as UserProfile;
}

export function listenUserProfile(uid: string, callback: (profile: UserProfile | null) => void): Unsubscribe {
  const profileRef = doc(db, "usuarios", uid);
  return onSnapshot(profileRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
  });
}

export async function loginWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(
  email: string,
  password: string,
  nome: string,
  tipoConta = "Hamburgueria / Restaurante",
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (nome) {
    await updateProfile(credential.user, { displayName: nome });
  }

  await ensureUserProfile(credential.user, nome, tipoConta);
  return credential;
}

export async function logoutUser() {
  await signOut(auth);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export function onAuthChange(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}
