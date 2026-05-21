"use client";

import { useCallback } from "react";

import { buscarExterno, buscarProdutoPorCodigo } from "../services/barcode.service";

export function useBarcode() {
  const buscarPorCodigo = useCallback((codigo: string) => buscarProdutoPorCodigo(codigo), []);
  const buscarProdutoExterno = useCallback((codigo: string) => buscarExterno(codigo), []);

  return { buscarExterno: buscarProdutoExterno, buscarPorCodigo };
}
