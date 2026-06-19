"use client";

import { useCallback, useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";

import { db } from "../lib/firebase";
import { getHistoricoEstoqueCollectionPath, getInsumosCollectionPath, normalizarInsumoFinanceiro } from "../services/estoque.service";
import type { Categoria, Historico, Insumo } from "../types";
import { useAuth } from "./useAuth";

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
  const { user, userProfile } = useAuth();
  const empresaId = userProfile?.empresaId || user?.uid || "";
  const lojaId = userProfile?.lojaId || "matriz";
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [kpis, setKpis] = useState<EstoqueKpis>(kpisIniciais);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!empresaId || !lojaId) {
      setInsumos([]);
      setKpis(kpisIniciais);
      setLoading(false);
      return undefined;
    }

    const consulta = query(collection(db, getInsumosCollectionPath(empresaId)), where("lojaId", "==", lojaId));

    return onSnapshot(
      consulta,
      async (snapshot) => {
        if (snapshot.empty) {
          const antigos = await getDocs(query(collection(db, "insumos"), where("empresaId", "==", empresaId), where("lojaId", "==", lojaId)));
          if (!antigos.empty) {
            const batch = writeBatch(db);
            antigos.docs.forEach((item) => {
              batch.set(doc(db, getInsumosCollectionPath(empresaId), item.id), normalizarInsumoFinanceiro({
                id: item.id,
                ...item.data(),
                empresaId,
                lojaId,
              } as Insumo));
            });
            await batch.commit();
            return;
          }
        }

        const items = snapshot.docs
          .map((item) => normalizarInsumoFinanceiro({ id: item.id, ...item.data() } as Insumo))
          .sort((a, b) => a.nome.localeCompare(b.nome));
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
  }, [empresaId, lojaId]);

  useEffect(() => {
    if (!empresaId) {
      setCategorias([]);
      return undefined;
    }

    const consulta = query(collection(db, "empresas", empresaId, "categoriasEstoque"), orderBy("ordem", "asc"));

    return onSnapshot(consulta, (snapshot) => {
      setCategorias(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Categoria));
    });
  }, [empresaId]);

  const criarInsumo = useCallback(async (dados: Partial<Insumo>, uid: string) => {
    if (!empresaId || !lojaId) throw new Error("Contexto de empresa/loja nao encontrado.");
    const payload = normalizarInsumoFinanceiro({
      ...dados,
      codigoBarrasNormalizado: dados.codigoBarras?.replace(/\D/g, "") || "",
      createdBy: uid,
      empresaId,
      lojaId,
      criadoEm: serverTimestamp(),
      nomeNormalizado: dados.nome?.toLowerCase() || "",
      atualizadoEm: serverTimestamp(),
    });
    const ref = await addDoc(collection(db, getInsumosCollectionPath(empresaId)), payload);

    return ref.id;
  }, [empresaId, lojaId]);

  const atualizarInsumo = useCallback(async (id: string, dados: Partial<Insumo>) => {
    if (!empresaId || !lojaId) throw new Error("Contexto de empresa/loja nao encontrado.");
    await updateDoc(doc(db, getInsumosCollectionPath(empresaId), id), normalizarInsumoFinanceiro({
      ...dados,
      codigoBarrasNormalizado: dados.codigoBarras?.replace(/\D/g, ""),
      empresaId,
      lojaId,
      nomeNormalizado: dados.nome?.toLowerCase(),
      atualizadoEm: serverTimestamp(),
    }));
  }, [empresaId, lojaId]);

  const deletarInsumo = useCallback(async (id: string, nome: string, responsavel: string) => {
    if (!empresaId || !lojaId) throw new Error("Contexto de empresa/loja nao encontrado.");
    const batch = writeBatch(db);
    batch.delete(doc(db, getInsumosCollectionPath(empresaId), id));
    batch.set(doc(collection(db, getHistoricoEstoqueCollectionPath(empresaId))), {
      empresaId,
      lojaId,
      insumoId: id,
      insumoNome: nome,
      tipo: "correcao",
      quantidade: 0,
      observacao: "Produto excluido do estoque",
      responsavel,
      criadoEm: serverTimestamp(),
    } satisfies Omit<Historico, "id" | "criadoEm"> & { criadoEm: unknown });
    await batch.commit();
  }, [empresaId, lojaId]);

  const criarInsumoComEntrada = useCallback(async (dados: CriarEntradaInput) => {
    if (!empresaId || !lojaId) throw new Error("Contexto de empresa/loja nao encontrado.");
    if (!dados.nome.trim()) throw new Error("Informe o nome do produto.");
    if (dados.quantidade <= 0) throw new Error("Quantidade deve ser maior que zero.");
    if (dados.custoTotal <= 0) throw new Error("Custo total deve ser maior que zero.");

    const custoUnitario = Math.round((dados.custoTotal / dados.quantidade) * 100) / 100;
    const batch = writeBatch(db);
    const insumoRef = doc(collection(db, getInsumosCollectionPath(empresaId)));
    const codigoNormalizado = dados.codigoBarras?.replace(/\D/g, "") || "";

    batch.set(insumoRef, normalizarInsumoFinanceiro({
      categoriaId: "",
      codigoBarras: dados.codigoBarras || "",
      codigoBarrasNormalizado: codigoNormalizado,
      conversao: 1,
      createdBy: dados.responsavel,
      empresaId,
      lojaId,
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
      estoqueAtual: dados.quantidade,
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
    }));

    batch.set(doc(collection(db, getHistoricoEstoqueCollectionPath(empresaId))), {
      criadoEm: serverTimestamp(),
      empresaId,
      lojaId,
      custoTotal: dados.custoTotal,
      custoUnitario,
      insumoId: insumoRef.id,
      insumoNome: dados.nome,
      observacao: `Entrada rapida em ${dados.unidade}`,
      quantidade: dados.quantidade,
      responsavel: dados.responsavel,
      tipo: "entrada",
      tipoMovimentacao: "entrada_manual",
      unidade: dados.unidade,
    });

    await batch.commit();
    return insumoRef.id;
  }, [empresaId, lojaId]);

  const registrarMovimento = useCallback(
    async (dados: MovimentoInput) => {
      if (!empresaId || !lojaId) throw new Error("Contexto de empresa/loja nao encontrado.");
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
      batch.update(doc(db, getInsumosCollectionPath(empresaId), dados.insumoId), normalizarInsumoFinanceiro({
        atualizadoEm: serverTimestamp(),
        custoAnterior: insumoAtual.custoCompra,
        custoCompra: novoCusto,
        custoUnitarioCompra: novoCusto,
        ...(!imagemAtual && dados.imagemUrl ? { imagemPrincipal: dados.imagemUrl, imagemUrl: dados.imagemUrl } : {}),
        quantidadeAtual: novaQuantidade,
        estoqueAtual: novaQuantidade,
      }));
      batch.set(doc(collection(db, getHistoricoEstoqueCollectionPath(empresaId))), {
        ...dados,
        empresaId,
        lojaId,
        custoUnitario: dados.custoTotal ? dados.custoTotal / dados.quantidade : null,
        custoTotal: dados.custoTotal || null,
        criadoEm: serverTimestamp(),
        data: serverTimestamp(),
        tipoMovimentacao: dados.tipo === "xml" ? "xml_nfe" : dados.tipo === "entrada" ? "entrada_manual" : dados.tipo,
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
    [empresaId, insumos, lojaId],
  );

  const zerarEstoque = useCallback(
    async (responsavel: string) => {
      if (!empresaId || !lojaId) throw new Error("Contexto de empresa/loja nao encontrado.");
      const batch = writeBatch(db);
      for (const insumo of insumos) {
        if (!insumo.id || insumo.quantidadeAtual <= 0) continue;
        batch.update(doc(db, getInsumosCollectionPath(empresaId), insumo.id), {
          atualizadoEm: serverTimestamp(),
          estoqueAtual: 0,
          quantidadeAtual: 0,
        });
        batch.set(doc(collection(db, getHistoricoEstoqueCollectionPath(empresaId))), {
          empresaId,
          lojaId,
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
    [empresaId, insumos, lojaId],
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
