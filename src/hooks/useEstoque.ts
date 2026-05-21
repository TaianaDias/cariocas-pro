"use client";

import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";

import { db } from "../lib/firebase";
import type { Categoria, Historico, Insumo } from "../types";

export interface EstoqueKpis {
  abaixoMinimo: number;
  proxVencimento: number;
  semFornecedor: number;
  precisaEtiqueta: number;
  aumentoCusto: number;
  margemBaixa: number;
}

type MovimentoInput = {
  custoTotal?: number;
  fornecedorId?: string;
  insumoId: string;
  insumoNome: string;
  observacao?: string;
  quantidade: number;
  responsavel: string;
  tipo: "entrada" | "saida" | "ajuste" | "correcao" | "xml" | "producao";
};

const kpisIniciais: EstoqueKpis = {
  abaixoMinimo: 0,
  aumentoCusto: 0,
  margemBaixa: 0,
  precisaEtiqueta: 0,
  proxVencimento: 0,
  semFornecedor: 0,
};

function calcularKpis(items: Insumo[]): EstoqueKpis {
  return {
    abaixoMinimo: items.filter((item) => item.quantidadeAtual <= item.estoqueMinimo && item.estoqueMinimo > 0).length,
    aumentoCusto: items.filter((item) => item.custoAnterior && item.custoCompra > item.custoAnterior).length,
    margemBaixa: items.filter((item) => item.margemEstimada > 0 && item.margemEstimada < 30).length,
    precisaEtiqueta: items.filter((item) => !item.tipoEtiqueta).length,
    proxVencimento: items.filter((item) => item.validadeOriginal > 0 && item.validadeOriginal <= 3).length,
    semFornecedor: items.filter((item) => !item.fornecedorPrincipal && !item.fornecedores?.length).length,
  };
}

export function useEstoque() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [kpis, setKpis] = useState<EstoqueKpis>(kpisIniciais);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const consulta = query(collection(db, "insumos"), orderBy("nome", "asc"));

    return onSnapshot(
      consulta,
      (snapshot) => {
        const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Insumo);
        setInsumos(items);
        setKpis(calcularKpis(items));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    const consulta = query(collection(db, "categoriasInsumos"), orderBy("ordem", "asc"));

    return onSnapshot(consulta, (snapshot) => {
      setCategorias(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Categoria));
    });
  }, []);

  const criarInsumo = useCallback(async (dados: Partial<Insumo>, uid: string) => {
    const ref = await addDoc(collection(db, "insumos"), {
      ...dados,
      codigoBarrasNormalizado: dados.codigoBarras?.replace(/\D/g, "") || "",
      createdBy: uid,
      criadoEm: serverTimestamp(),
      nomeNormalizado: dados.nome?.toLowerCase() || "",
      atualizadoEm: serverTimestamp(),
    });

    return ref.id;
  }, []);

  const atualizarInsumo = useCallback(async (id: string, dados: Partial<Insumo>) => {
    await updateDoc(doc(db, "insumos", id), {
      ...dados,
      codigoBarrasNormalizado: dados.codigoBarras?.replace(/\D/g, ""),
      nomeNormalizado: dados.nome?.toLowerCase(),
      atualizadoEm: serverTimestamp(),
    });
  }, []);

  const deletarInsumo = useCallback(async (id: string, nome: string, responsavel: string) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, "insumos", id));
    batch.set(doc(collection(db, "historico")), {
      insumoId: id,
      insumoNome: nome,
      tipo: "correcao",
      quantidade: 0,
      observacao: "Produto excluido do estoque",
      responsavel,
      criadoEm: serverTimestamp(),
    } satisfies Omit<Historico, "id" | "criadoEm"> & { criadoEm: unknown });
    await batch.commit();
  }, []);

  const registrarMovimento = useCallback(
    async (dados: MovimentoInput) => {
      const insumoAtual = insumos.find((item) => item.id === dados.insumoId);
      if (!insumoAtual?.id) throw new Error("Insumo nao encontrado");

      let novaQuantidade = insumoAtual.quantidadeAtual;
      let novoCusto = insumoAtual.custoCompra;

      if (dados.tipo === "entrada") {
        novaQuantidade += dados.quantidade;
        if (dados.custoTotal && novaQuantidade > 0) {
          novoCusto = Math.round(((insumoAtual.quantidadeAtual * insumoAtual.custoCompra + dados.custoTotal) / novaQuantidade) * 100) / 100;
        }
      }

      if (dados.tipo === "saida" || dados.tipo === "producao") {
        if (insumoAtual.quantidadeAtual < dados.quantidade) throw new Error("Estoque insuficiente");
        novaQuantidade -= dados.quantidade;
      }

      const batch = writeBatch(db);
      batch.update(doc(db, "insumos", dados.insumoId), {
        atualizadoEm: serverTimestamp(),
        custoAnterior: insumoAtual.custoCompra,
        custoCompra: novoCusto,
        quantidadeAtual: novaQuantidade,
      });
      batch.set(doc(collection(db, "historico")), {
        ...dados,
        custoUnitario: dados.custoTotal ? dados.custoTotal / dados.quantidade : null,
        custoTotal: dados.custoTotal || null,
        criadoEm: serverTimestamp(),
      });

      await batch.commit();

      try {
        await fetch("/api/automacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dados: { whatsappNumber: "5521988531687" },
            insumoId: dados.insumoId,
            insumoNome: dados.insumoNome,
            quantidade: dados.quantidade,
            responsavel: dados.responsavel,
            tipo: dados.tipo,
          }),
        });
      } catch (err) {
        console.error("Erro ao disparar automacao de estoque:", err);
      }
    },
    [insumos],
  );

  const zerarEstoque = useCallback(
    async (responsavel: string) => {
      const batch = writeBatch(db);
      for (const insumo of insumos) {
        if (!insumo.id || insumo.quantidadeAtual <= 0) continue;
        batch.update(doc(db, "insumos", insumo.id), {
          atualizadoEm: serverTimestamp(),
          quantidadeAtual: 0,
        });
        batch.set(doc(collection(db, "historico")), {
          insumoId: insumo.id,
          insumoNome: insumo.nome,
          tipo: "correcao",
          quantidade: insumo.quantidadeAtual,
          observacao: "Estoque zerado manualmente",
          responsavel,
          criadoEm: serverTimestamp(),
        });
      }
      await batch.commit();
    },
    [insumos],
  );

  return {
    atualizarInsumo,
    categorias,
    criarInsumo,
    deletarInsumo,
    error,
    insumos,
    kpis,
    loading,
    refetch: () => undefined,
    registrarMovimento,
    zerarEstoque,
  };
}
