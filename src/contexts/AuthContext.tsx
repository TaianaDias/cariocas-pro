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
  loginWithEmail,
  logoutUser,
  onAuthChange,
  registerWithEmail,
  type UserProfile,
} from "../services/auth.service";

type AuthContextValue = {
  error: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, nome: string, tipoConta?: string) => Promise<void>;
  user: User | null;
  userProfile: UserProfile | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

function getFriendlyAuthError(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return "Nao foi possivel concluir a autenticacao. Tente novamente.";
  }

  const messages: Record<string, string> = {
    "auth/admin-restricted-operation": "O cadastro por email e senha esta desativado no Firebase Authentication.",
    "auth/email-already-in-use": "Este email ja esta cadastrado. Tente fazer login.",
    "auth/invalid-api-key": "A chave do Firebase esta invalida. Confira o arquivo .env.local.",
    "auth/invalid-credential": "Email ou senha invalidos.",
    "auth/invalid-email": "Informe um email valido.",
    "auth/network-request-failed": "Falha de conexao com o Firebase. Verifique sua internet.",
    "auth/operation-not-allowed": "Ative o metodo Email/Senha no Firebase Authentication.",
    "auth/user-not-found": "Nao encontramos uma conta com este email.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/wrong-password": "Senha incorreta.",
    "permission-denied": "O login funcionou, mas o Firestore bloqueou o perfil em usuarios/{uid}. Confira as regras.",
  };

  return messages[error.code] ?? `Firebase retornou: ${error.code}`;
}

function setAuthCookies(currentUser: User | null, profile: UserProfile | null) {
  if (!currentUser) {
    document.cookie = "user.uid=; path=/; max-age=0; sameSite=lax";
    document.cookie = "user.email=; path=/; max-age=0; sameSite=lax";
    document.cookie = "user.plan=; path=/; max-age=0; sameSite=lax";
    return;
  }

  document.cookie = `user.uid=${currentUser.uid}; path=/; sameSite=lax`;
  document.cookie = `user.email=${currentUser.email ?? ""}; path=/; sameSite=lax`;
  document.cookie = `user.plan=${profile?.plano ?? profile?.plan ?? "free"}; path=/; sameSite=lax`;
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
    setUserProfile(profile);
    setAuthCookies(currentUser, profile);
    return profile;
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
      } catch {
        setError("Nao foi possivel carregar o perfil do usuario.");
        setUserProfile(null);
        if (currentUser) {
          setAuthCookies(currentUser, null);
        }
      } finally {
        setLoading(false);
      }
    });
  }, [loadUserProfile]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      setLoading(true);

      try {
        const credential = await loginWithEmail(email, password);
        setUser(credential.user);
        await loadUserProfile(credential.user);
      } catch (error) {
        const message = getFriendlyAuthError(error);
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
      } catch (error) {
        const message = getFriendlyAuthError(error);
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
      setError("Nao foi possivel sair da conta agora.");
      throw new Error("Nao foi possivel sair da conta agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      error,
      loading,
      login,
      logout,
      register,
      user,
      userProfile,
    }),
    [error, loading, login, logout, register, user, userProfile],
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
