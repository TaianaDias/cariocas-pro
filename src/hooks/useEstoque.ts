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
  imagemUrl?: string;
  insumoId: string;
  insumoNome: string;
  observacao?: string;
  quantidade: number;
  responsavel: string;
  tipo: "entrada" | "saida" | "ajuste" | "correcao" | "xml" | "producao";
};

type CriarEntradaInput = {
  codigoBarras?: string;
  custoTotal: number;
  imagemUrl?: string;
  marca?: string;
  nome: string;
  quantidade: number;
  responsavel: string;
  unidade: string;
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

  const criarInsumoComEntrada = useCallback(async (dados: CriarEntradaInput) => {
    if (!dados.nome.trim()) throw new Error("Informe o nome do produto.");
    if (dados.quantidade <= 0) throw new Error("Quantidade deve ser maior que zero.");
    if (dados.custoTotal <= 0) throw new Error("Custo total deve ser maior que zero.");

    const custoUnitario = Math.round((dados.custoTotal / dados.quantidade) * 100) / 100;
    const batch = writeBatch(db);
    const insumoRef = doc(collection(db, "insumos"));
    const codigoNormalizado = dados.codigoBarras?.replace(/\D/g, "") || "";

    batch.set(insumoRef, {
      categoriaId: "",
      codigoBarras: dados.codigoBarras || "",
      codigoBarrasNormalizado: codigoNormalizado,
      conversao: 1,
      createdBy: dados.responsavel,
      criadoEm: serverTimestamp(),
      custoCompra: custoUnitario,
      custoUnitario,
      diasEntrega: 0,
      diasPedido: 0,
      estoqueMaximo: 0,
      estoqueMinimo: 0,
      frequenciaPedido: "",
      imagemPrincipal: dados.imagemUrl || "",
      imagemUrl: dados.imagemUrl || "",
      localArmazenamento: "",
      loteInterno: "",
      marca: dados.marca || "",
      margemEstimada: 0,
      cmv: 0,
      nome: dados.nome,
      nomeNormalizado: dados.nome.toLowerCase(),
      observacao: "Criado pela entrada rapida por codigo de barras",
      origemCadastro: "barcode",
      precosVenda: [],
      promocaoAtiva: false,
      quantidadeAtual: dados.quantidade,
      quantidadePadraoPedido: 0,
      responsavel: dados.responsavel,
      sku: codigoNormalizado ? `BAR-${codigoNormalizado}` : `MANUAL-${Date.now()}`,
      status: "ativo",
      statusProduto: "ativo",
      tipoEtiqueta: "",
      unidadeCompra: dados.unidade,
      unidadeMedida: dados.unidade,
      unidadeUso: dados.unidade,
      validadeAposAberto: 0,
      validadeAposProducao: 0,
      validadeOriginal: 0,
      atualizadoEm: serverTimestamp(),
    });

    batch.set(doc(collection(db, "historico")), {
      criadoEm: serverTimestamp(),
      custoTotal: dados.custoTotal,
      custoUnitario,
      insumoId: insumoRef.id,
      insumoNome: dados.nome,
      observacao: `Entrada rapida em ${dados.unidade}`,
      quantidade: dados.quantidade,
      responsavel: dados.responsavel,
      tipo: "entrada",
      unidade: dados.unidade,
    });

    await batch.commit();
    return insumoRef.id;
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
      const imagemAtual = insumoAtual.imagemUrl || insumoAtual.imagemPrincipal || insumoAtual.imagemUploadUrl || insumoAtual.imagemCosmosUrl || "";
      batch.update(doc(db, "insumos", dados.insumoId), {
        atualizadoEm: serverTimestamp(),
        custoAnterior: insumoAtual.custoCompra,
        custoCompra: novoCusto,
        ...(!imagemAtual && dados.imagemUrl ? { imagemPrincipal: dados.imagemUrl, imagemUrl: dados.imagemUrl } : {}),
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
    criarInsumoComEntrada,
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
