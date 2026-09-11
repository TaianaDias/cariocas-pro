"use client";

import { useCallback } from "react";

import { isOperationalRole } from "../lib/access-control";
import { operationalStockItemToInsumo, type OperationalStockItem } from "../lib/operational-stock";
import { buscarProdutoPorCodigo, normalizarCodigo, type ProdutoExterno } from "../services/barcode.service";
import { useAuth } from "./useAuth";

export function useBarcode() {
  const { user, userProfile } = useAuth();
  const empresaId = userProfile?.empresaId || user?.uid || "";
  const lojaId = userProfile?.lojaId || "matriz";
  const operational = isOperationalRole(userProfile?.role);

  const buscarPorCodigo = useCallback(async (codigo: string) => {
    if (!operational) {
      return buscarProdutoPorCodigo(codigo, { empresaId, lojaId });
    }

    if (!user) return null;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/estoque/operacional?codigo=${encodeURIComponent(codigo)}`, {
        headers: { authorization: `Bearer ${token}` },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as { items?: OperationalStockItem[] };
      const item = data.items?.[0];
      return item ? operationalStockItemToInsumo(item) : null;
    } catch {
      return null;
    }
  }, [empresaId, lojaId, operational, user]);

  const buscarProdutoExterno = useCallback(async (codigo: string): Promise<ProdutoExterno | null> => {
    if (!user) return null;
    const normalizado = normalizarCodigo(codigo);
    if (!normalizado) return null;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/barcode/lookup?codigo=${encodeURIComponent(normalizado)}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;

      const data = (await response.json()) as ProdutoExterno;
      return {
        imagemUrl: data.imagemUrl || "",
        marca: data.marca || "",
        nome: data.nome || "",
      };
    } catch {
      return null;
    }
  }, [user]);

  return { buscarExterno: buscarProdutoExterno, buscarPorCodigo };
}
