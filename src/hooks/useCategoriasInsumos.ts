"use client";

import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, updateDoc, doc } from "firebase/firestore";

import { db } from "../lib/firebase";
import type { Categoria } from "../types";

const CATEGORIAS_PADRAO = [
  { cor: "#DC2626", icone: "C", nome: "Carnes", ordem: 1 },
  { cor: "#D97706", icone: "P", nome: "Paes", ordem: 2 },
  { cor: "#F59E0B", icone: "Q", nome: "Queijos", ordem: 3 },
  { cor: "#8B5CF6", icone: "M", nome: "Molhos", ordem: 4 },
  { cor: "#22C55E", icone: "H", nome: "Hortifruti", ordem: 5 },
  { cor: "#3B82F6", icone: "B", nome: "Bebidas", ordem: 6 },
  { cor: "#6B7280", icone: "E", nome: "Embalagens", ordem: 7 },
  { cor: "#EC4899", icone: "L", nome: "Limpeza", ordem: 8 },
  { cor: "#06B6D4", icone: "F", nome: "Congelados", ordem: 9 },
  { cor: "#F97316", icone: "P", nome: "Producao Propria", ordem: 10 },
];

type CategoriaComOculta = Categoria & { oculta?: boolean };

export function useCategoriasInsumos() {
  const [categorias, setCategorias] = useState<CategoriaComOculta[]>([]);
  const [categoriasRemovidas, setCategoriasRemovidas] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const consulta = query(collection(db, "categoriasInsumos"), orderBy("ordem", "asc"));

    return onSnapshot(consulta, (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CategoriaComOculta);
      if (items.length === 0) {
        CATEGORIAS_PADRAO.forEach((categoria) => {
          addDoc(collection(db, "categoriasInsumos"), { ...categoria, criadoEm: serverTimestamp() });
        });
      }
      setCategorias(items);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const consulta = query(collection(db, "categoriasInsumosRemovidas"), orderBy("ordem", "asc"));

    return onSnapshot(consulta, (snapshot) => {
      setCategoriasRemovidas(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Categoria));
    });
  }, []);

  const criarCategoria = useCallback(
    async (nome: string, cor = "#6B7280", icone = "C") => {
      const maxOrdem = categorias.reduce((max, categoria) => Math.max(max, categoria.ordem || 0), 0);
      await addDoc(collection(db, "categoriasInsumos"), {
        cor,
        criadoEm: serverTimestamp(),
        icone,
        nome,
        ordem: maxOrdem + 1,
      });
    },
    [categorias],
  );

  const ocultarCategoria = useCallback(
    async (id: string) => {
      const categoria = categorias.find((item) => item.id === id);
      if (!categoria) return;
      await addDoc(collection(db, "categoriasInsumosRemovidas"), categoria);
      await updateDoc(doc(db, "categoriasInsumos", id), { oculta: true });
    },
    [categorias],
  );

  return {
    categoriasList: categorias.filter((categoria) => !categoria.oculta),
    categoriasRemovidas,
    criarCategoria,
    loading,
    ocultarCategoria,
  };
}
