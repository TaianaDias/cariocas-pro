"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";

import { observeAuthState, signOutUser } from "../../lib/auth";

type AuthContextValue = {
  loading: boolean;
  signOut: () => Promise<void>;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return observeAuthState((currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        document.cookie = `user.uid=${currentUser.uid}; path=/; sameSite=lax`;
        document.cookie = `user.email=${currentUser.email ?? ""}; path=/; sameSite=lax`;
      } else {
        document.cookie = "user.uid=; path=/; max-age=0";
        document.cookie = "user.email=; path=/; max-age=0";
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      signOut: signOutUser,
      user,
    }),
    [loading, user],
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
