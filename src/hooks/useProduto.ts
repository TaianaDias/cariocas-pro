"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "../lib/firebase";
import type { Insumo } from "../types";
import { useAuth } from "./useAuth";

export function useProduto(produtoId: string | null) {
  const { user, userProfile } = useAuth();
  const empresaId = userProfile?.empresaId || user?.uid || "";
  const lojaId = userProfile?.lojaId || "matriz";
  const [produto, setProduto] = useState<Insumo | null>(null);
  const [loading, setLoading] = useState(Boolean(produtoId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!produtoId) {
      setProduto(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    return onSnapshot(
      doc(db, "insumos", produtoId),
      (snapshot) => {
        const data = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Insumo) : null;
        if (data && data.empresaId && data.empresaId !== empresaId) {
          setProduto(null);
          setError("Produto nao pertence a esta empresa.");
          setLoading(false);
          return;
        }

        if (data && data.lojaId && data.lojaId !== lojaId) {
          setProduto(null);
          setError("Produto nao pertence a esta loja.");
          setLoading(false);
          return;
        }

        setProduto(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [empresaId, lojaId, produtoId]);

  return { error, loading, produto };
}
