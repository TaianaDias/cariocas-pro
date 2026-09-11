"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { FirebaseError } from "firebase/app";

import {
  ensureUserProfile,
  getUserProfile,
  listenUserProfile,
  loginWithEmail,
  logoutUser,
  onAuthChange,
  registerWithEmail,
  type UserProfile,
} from "../services/auth.service";
import { atualizarPlano } from "../services/usuarios.service";
import type { Plano } from "../lib/plan";
import { isOperationalRole, serializePermissions } from "../lib/access-control";

type AuthContextValue = {
  error: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, nome: string, tipoConta?: string) => Promise<void>;
  updatePlan: (plano: Plano) => Promise<void>;
  user: User | null;
  userProfile: UserProfile | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

function getFriendlyAuthError(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error ? error.message : "Não foi possível concluir a autenticação. Tente novamente.";
  }

  const messages: Record<string, string> = {
    "auth/admin-restricted-operation": "O cadastro por e-mail e senha está desativado no Firebase Authentication.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado. Tente fazer login.",
    "auth/invalid-api-key": "A chave do Firebase está inválida. Confira o arquivo .env.local.",
    "auth/invalid-credential": "E-mail ou senha inválidos.",
    "auth/invalid-email": "Informe um e-mail válido.",
    "auth/network-request-failed": "Falha de conexão com o Firebase. Verifique sua internet.",
    "auth/operation-not-allowed": "Ative o método E-mail/Senha no Firebase Authentication.",
    "auth/user-disabled": "Este acesso está desativado. Procure o administrador da empresa.",
    "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/wrong-password": "Senha incorreta.",
    "permission-denied": "O login funcionou, mas o Firestore bloqueou o perfil em usuarios/{uid}. Confira as regras.",
  };

  return messages[error.code] ?? `Firebase retornou: ${error.code}`;
}

function isInactiveProfile(profile: UserProfile | null) {
  if (!profile) return false;
  if (profile.ativo === false) return true;
  return isOperationalRole(profile.role) && profile.funcionarioAtivo === false;
}

function setAuthCookies(currentUser: User | null, profile: UserProfile | null) {
  if (!currentUser) {
    document.cookie = "user.uid=; path=/; max-age=0; sameSite=lax";
    document.cookie = "user.email=; path=/; max-age=0; sameSite=lax";
    document.cookie = "user.plan=; path=/; max-age=0; sameSite=lax";
    document.cookie = "user.role=; path=/; max-age=0; sameSite=lax";
    document.cookie = "user.permissions=; path=/; max-age=0; sameSite=lax";
    document.cookie = "user.empresaId=; path=/; max-age=0; sameSite=lax";
    document.cookie = "user.lojaId=; path=/; max-age=0; sameSite=lax";
    return;
  }

  document.cookie = `user.uid=${currentUser.uid}; path=/; sameSite=lax`;
  document.cookie = `user.email=${currentUser.email ?? ""}; path=/; sameSite=lax`;
  document.cookie = `user.plan=${profile?.plano ?? profile?.plan ?? "free"}; path=/; sameSite=lax`;
  document.cookie = `user.role=${profile?.role ?? "user"}; path=/; sameSite=lax`;
  document.cookie = `user.permissions=${serializePermissions(profile?.permissoes)}; path=/; sameSite=lax`;
  document.cookie = `user.empresaId=${profile?.empresaId ?? ""}; path=/; sameSite=lax`;
  document.cookie = `user.lojaId=${profile?.lojaId ?? ""}; path=/; sameSite=lax`;
}

async function runOnboarding(currentUser: User, profile: UserProfile | null) {
  const token = await currentUser.getIdToken();
  const response = await fetch("/api/onboarding", {
    body: JSON.stringify({
      nome: profile?.nome || currentUser.displayName || "Usuário",
      tipoConta: profile?.tipoConta || "Hamburgueria / Restaurante",
    }),
    headers: {
      authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Não foi possível preparar a empresa para este usuário.");
  }
}

function hasRequiredTenantContext(profile: UserProfile | null) {
  return Boolean(profile?.empresaId && profile?.lojaId && profile?.role);
}

function refreshOnboardingInBackground(currentUser: User, profile: UserProfile | null) {
  // Funcionários e gerentes recebem o tenant pronto no provisionamento e nunca
  // executam rotina de criação/configuração da empresa.
  if (profile && isOperationalRole(profile.role)) return;

  void runOnboarding(currentUser, profile).catch((error) => {
    console.warn("Onboarding em segundo plano indisponível.", error);
  });
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const loadUserProfile = useCallback(async (currentUser: User) => {
    setAuthCookies(currentUser, null);
    const existingProfile = await getUserProfile(currentUser.uid);
    const profile = existingProfile ?? (await ensureUserProfile(currentUser));

    if (isInactiveProfile(profile)) {
      await logoutUser().catch(() => undefined);
      setAuthCookies(null, null);
      throw new Error("Este acesso está desativado. Procure o administrador da empresa.");
    }

    if (hasRequiredTenantContext(profile)) {
      setUserProfile(profile);
      setAuthCookies(currentUser, profile);
      refreshOnboardingInBackground(currentUser, profile);
      return profile;
    }

    await runOnboarding(currentUser, profile);

    const onboardedProfile = await getUserProfile(currentUser.uid);
    const nextProfile = onboardedProfile ?? profile;
    if (isInactiveProfile(nextProfile)) {
      await logoutUser().catch(() => undefined);
      setAuthCookies(null, null);
      throw new Error("Este acesso está desativado. Procure o administrador da empresa.");
    }

    setUserProfile(nextProfile);
    setAuthCookies(currentUser, nextProfile);
    return nextProfile;
  }, []);

  useEffect(() => {
    return onAuthChange(async (currentUser) => {
      setLoading(true);
      setError(null);
      setUser(currentUser);

      try {
        if (currentUser) {
          setAuthCookies(currentUser, null);
          await loadUserProfile(currentUser);
        } else {
          setUserProfile(null);
          setAuthCookies(null, null);
        }
      } catch (profileError) {
        setError(profileError instanceof Error ? profileError.message : "Não foi possível carregar o perfil do usuário.");
        setUserProfile(null);
        if (currentUser) {
          setAuthCookies(currentUser, null);
        }
      } finally {
        setLoading(false);
      }
    });
  }, [loadUserProfile]);

  useEffect(() => {
    if (!user) return undefined;

    return listenUserProfile(user.uid, (profile) => {
      if (!profile) return;
      if (isInactiveProfile(profile)) {
        setError("Este acesso está desativado. Procure o administrador da empresa.");
        setUserProfile(null);
        setAuthCookies(null, null);
        void logoutUser();
        return;
      }
      setUserProfile(profile);
      setAuthCookies(user, profile);
    });
  }, [user]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      setLoading(true);

      try {
        const credential = await loginWithEmail(email, password);
        setUser(credential.user);
        await loadUserProfile(credential.user);
      } catch (loginError) {
        const message = getFriendlyAuthError(loginError);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [loadUserProfile],
  );

  const register = useCallback(
    async (email: string, password: string, nome: string, tipoConta?: string) => {
      setError(null);
      setLoading(true);

      try {
        const credential = await registerWithEmail(email, password, nome, tipoConta);
        setUser(credential.user);
        await loadUserProfile(credential.user);
      } catch (registerError) {
        const message = getFriendlyAuthError(registerError);
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [loadUserProfile],
  );

  const logout = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      await logoutUser();
      setUser(null);
      setUserProfile(null);
      setAuthCookies(null, null);
    } catch {
      setError("Não foi possível sair da conta agora.");
      throw new Error("Não foi possível sair da conta agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePlan = useCallback(
    async (plano: Plano) => {
      if (!user) {
        throw new Error("Entre na conta para escolher um plano.");
      }

      await atualizarPlano(user.uid, plano);
      const nextProfile: UserProfile = {
        ...(userProfile ?? {
          email: user.email || "",
          nome: user.displayName || "Usuário",
          role: "user",
          tipoConta: "Hamburgueria / Restaurante",
          uid: user.uid,
        }),
        plan: plano,
        plano,
      };

      setUserProfile(nextProfile);
      setAuthCookies(user, nextProfile);
    },
    [user, userProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      error,
      loading,
      login,
      logout,
      register,
      updatePlan,
      user,
      userProfile,
    }),
    [error, loading, login, logout, register, updatePlan, user, userProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }

  return context;
}
