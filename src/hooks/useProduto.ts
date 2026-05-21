"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "../lib/firebase";
import type { Insumo } from "../types";

export function useProduto(produtoId: string | null) {
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
        setProduto(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Insumo) : null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [produtoId]);

  return { error, loading, produto };
}
