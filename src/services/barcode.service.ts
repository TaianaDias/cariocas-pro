import { collection, getDocs, limit, query, where } from "firebase/firestore";

import { db } from "../lib/firebase";
import type { Insumo } from "../types";

const cache = new Map<string, Insumo>();

export function normalizarCodigo(codigo: string): string {
  return codigo.replace(/\D/g, "");
}

export async function buscarProdutoPorCodigo(codigo: string): Promise<Insumo | null> {
  const normalizado = normalizarCodigo(codigo);

  if (!normalizado) return null;
  if (cache.has(normalizado)) return cache.get(normalizado)!;

  const consulta = query(collection(db, "insumos"), where("codigoBarrasNormalizado", "==", normalizado), limit(1));
  const snap = await getDocs(consulta);

  if (!snap.empty) {
    const produto = { id: snap.docs[0].id, ...snap.docs[0].data() } as Insumo;
    cache.set(normalizado, produto);
    return produto;
  }

  return null;
}

export async function buscarExterno(codigo: string): Promise<{ nome: string; marca: string } | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_COSMOS_API_KEY;
    if (!apiKey) return null;

    const response = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${normalizarCodigo(codigo)}.json`, {
      headers: { "X-Cosmos-Token": apiKey },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      marca: data?.brand?.name || data?.manufacturer || "",
      nome: data?.description || data?.product_name || "",
    };
  } catch {
    return null;
  }
}

export async function validarDuplicidade(codigo: string, ignorarId?: string): Promise<boolean> {
  const normalizado = normalizarCodigo(codigo);
  if (!normalizado) return false;

  const consulta = query(collection(db, "insumos"), where("codigoBarrasNormalizado", "==", normalizado), limit(2));
  const snap = await getDocs(consulta);

  return snap.docs.some((item) => item.id !== ignorarId);
}
