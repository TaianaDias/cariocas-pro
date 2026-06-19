import { collection, getDocs, limit, query, where } from "firebase/firestore";

import { db } from "../lib/firebase";
import type { Insumo } from "../types";

const cache = new Map<string, Insumo>();

type TenantContext = {
  empresaId?: string;
  lojaId?: string;
};

export function normalizarCodigo(codigo: string): string {
  return codigo.replace(/\D/g, "");
}

export async function buscarProdutoPorCodigo(codigo: string, context: TenantContext = {}): Promise<Insumo | null> {
  const normalizado = normalizarCodigo(codigo);
  const codigoLimpo = codigo.trim();
  const cacheKey = `${context.empresaId || "global"}:${context.lojaId || "global"}:${normalizado}`;

  if (!normalizado && !codigoLimpo) return null;
  if (normalizado && cache.has(cacheKey)) return cache.get(cacheKey)!;

  const tenantFilters = [
    ...(context.empresaId ? [where("empresaId", "==", context.empresaId)] : []),
    ...(context.lojaId ? [where("lojaId", "==", context.lojaId)] : []),
  ];

  const buscas = [
    normalizado ? query(collection(db, "insumos"), ...tenantFilters, where("codigoBarrasNormalizado", "==", normalizado), limit(1)) : null,
    codigoLimpo ? query(collection(db, "insumos"), ...tenantFilters, where("codigoBarras", "==", codigoLimpo), limit(1)) : null,
    normalizado && normalizado !== codigoLimpo ? query(collection(db, "insumos"), ...tenantFilters, where("codigoBarras", "==", normalizado), limit(1)) : null,
  ].filter(Boolean);

  for (const consulta of buscas) {
    const snap = await getDocs(consulta!);

    if (!snap.empty) {
      const produto = { id: snap.docs[0].id, ...snap.docs[0].data() } as Insumo;
      if (normalizado) cache.set(cacheKey, produto);
      return produto;
    }
  }

  return null;
}

export type ProdutoExterno = {
  imagemUrl?: string;
  marca: string;
  nome: string;
};

export async function buscarExterno(codigo: string): Promise<ProdutoExterno | null> {
  const normalizado = normalizarCodigo(codigo);
  if (!normalizado) return null;

  try {
    const apiKey = process.env.NEXT_PUBLIC_COSMOS_API_KEY;
    if (apiKey) {
      const response = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${normalizado}.json`, {
        headers: { "X-Cosmos-Token": apiKey },
      });

      if (response.ok) {
        const data = await response.json();
        const nome = data?.description || data?.product_name || "";
        if (nome) {
          return {
            imagemUrl: data?.thumbnail || data?.image || data?.image_url || data?.picture || "",
            marca: data?.brand?.name || data?.manufacturer || "",
            nome,
          };
        }
      }
    }

    const openFoodResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${normalizado}.json?fields=product_name,brands,generic_name,image_url,image_front_url`);
    if (!openFoodResponse.ok) return null;

    const data = await openFoodResponse.json();
    if (data?.status !== 1 || !data?.product) return null;

    return {
      imagemUrl: data.product.image_front_url || data.product.image_url || "",
      marca: data.product.brands || "",
      nome: data.product.product_name || data.product.generic_name || "",
    };
  } catch {
    return null;
  }
}

export async function validarDuplicidade(codigo: string, ignorarId?: string, context: TenantContext = {}): Promise<boolean> {
  const normalizado = normalizarCodigo(codigo);
  if (!normalizado) return false;

  const consulta = query(
    collection(db, "insumos"),
    ...(context.empresaId ? [where("empresaId", "==", context.empresaId)] : []),
    ...(context.lojaId ? [where("lojaId", "==", context.lojaId)] : []),
    where("codigoBarrasNormalizado", "==", normalizado),
    limit(2),
  );
  const snap = await getDocs(consulta);

  return snap.docs.some((item) => item.id !== ignorarId);
}
