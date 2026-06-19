"use client";

import { useCallback } from "react";

import { buscarExterno, buscarProdutoPorCodigo } from "../services/barcode.service";
import { useAuth } from "./useAuth";

export function useBarcode() {
  const { user, userProfile } = useAuth();
  const empresaId = userProfile?.empresaId || user?.uid || "";
  const lojaId = userProfile?.lojaId || "matriz";
  const buscarPorCodigo = useCallback((codigo: string) => buscarProdutoPorCodigo(codigo, { empresaId, lojaId }), [empresaId, lojaId]);
  const buscarProdutoExterno = useCallback((codigo: string) => buscarExterno(codigo), []);

  return { buscarExterno: buscarProdutoExterno, buscarPorCodigo };
}
