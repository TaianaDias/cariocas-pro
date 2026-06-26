"use client";

import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";

import { db } from "../lib/firebase";
import type { Categoria } from "../types";
import { useAuth } from "./useAuth";

const CATEGORIAS_PADRAO = [
  { cor: "#DC2626", icone: "C", id: "carnes", nome: "Carnes", ordem: 1 },
  { cor: "#D97706", icone: "P", id: "paes", nome: "Paes", ordem: 2 },
  { cor: "#F59E0B", icone: "Q", id: "queijos", nome: "Queijos", ordem: 3 },
  { cor: "#8B5CF6", icone: "M", id: "molhos", nome: "Molhos", ordem: 4 },
  { cor: "#22C55E", icone: "H", id: "hortifruti", nome: "Hortifruti", ordem: 5 },
  { cor: "#3B82F6", icone: "B", id: "bebidas", nome: "Bebidas", ordem: 6 },
  { cor: "#6B7280", icone: "E", id: "embalagens", nome: "Embalagens", ordem: 7 },
  { cor: "#EC4899", icone: "L", id: "limpeza", nome: "Limpeza", ordem: 8 },
  { cor: "#F97316", icone: "P", id: "producao-propria", nome: "Producao Propria", ordem: 9 },
];

type CategoriaComOculta = Categoria & { oculta?: boolean };

export function useCategoriasInsumos() {
  const { user, userProfile } = useAuth();
  const empresaId = userProfile?.empresaId || user?.uid || "";
  const lojaId = userProfile?.lojaId || "matriz";
  const [categorias, setCategorias] = useState<CategoriaComOculta[]>([]);
  const [categoriasRemovidas, setCategoriasRemovidas] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) {
      setCategorias([]);
      setLoading(false);
      return undefined;
    }

    const categoriasRef = collection(db, "empresas", empresaId, "categoriasEstoque");
    const consulta = query(categoriasRef, orderBy("ordem", "asc"));

    return onSnapshot(consulta, (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CategoriaComOculta);
      if (items.length === 0) {
        const batch = writeBatch(db);
        CATEGORIAS_PADRAO.forEach((categoria) => {
          batch.set(doc(categoriasRef, categoria.id), {
            ...categoria,
            ativo: true,
            criadoEm: serverTimestamp(),
            empresaId,
            lojaId,
            nomeNormalizado: categoria.id,
            atualizadoEm: serverTimestamp(),
          }, { merge: true });
        });
        void batch.commit();
      }
      setCategorias(items);
      setLoading(false);
    });
  }, [empresaId, lojaId]);

  useEffect(() => {
    if (!empresaId) {
      setCategoriasRemovidas([]);
      return undefined;
    }

    const consulta = query(collection(db, "empresas", empresaId, "categoriasEstoqueRemovidas"), orderBy("ordem", "asc"));

    return onSnapshot(consulta, (snapshot) => {
      setCategoriasRemovidas(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Categoria));
    });
  }, [empresaId]);

  const criarCategoria = useCallback(
    async (nome: string, cor = "#6B7280", icone = "C") => {
      const maxOrdem = categorias.reduce((max, categoria) => Math.max(max, categoria.ordem || 0), 0);
      if (!empresaId) throw new Error("Contexto de empresa nao encontrado.");
      await addDoc(collection(db, "empresas", empresaId, "categoriasEstoque"), {
        ativo: true,
        cor,
        criadoEm: serverTimestamp(),
        empresaId,
        icone,
        lojaId,
        nome,
        nomeNormalizado: nome.toLowerCase(),
        ordem: maxOrdem + 1,
      });
    },
    [categorias, empresaId, lojaId],
  );

  const ocultarCategoria = useCallback(
    async (id: string) => {
      const categoria = categorias.find((item) => item.id === id);
      if (!categoria) return;
      if (!empresaId) throw new Error("Contexto de empresa nao encontrado.");
      await addDoc(collection(db, "empresas", empresaId, "categoriasEstoqueRemovidas"), categoria);
      await updateDoc(doc(db, "empresas", empresaId, "categoriasEstoque", id), { oculta: true, atualizadoEm: serverTimestamp() });
    },
    [categorias, empresaId],
  );

  return {
    categoriasList: categorias.filter((categoria) => !categoria.oculta),
    categoriasRemovidas,
    criarCategoria,
    loading,
    ocultarCategoria,
  };
}
